#pragma once

// SlipLoop DSP engine — JUCE-free so it can be unit tested on any machine.
//
// Model
//   t      = absolute output sample counter (advances every processed sample)
//   src    = position in the recorded input stream (ring buffer, always written)
//   D      = offset between output and source (0 = live / slip, >0 = "continue" mode)
//
//   Live state:  src(t) = t - D
//   Loop state:  src(t) = A + mod(t - D - A, L)
//
// The ring buffer records the plugin input continuously (that is what makes
// slip mode work: the track keeps advancing underneath). When a loop engages,
// the loop region is copied into a second buffer at the same indices so the
// ring can keep recording without ever overwriting the loop being played.

#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdint>
#include <vector>

class LoopEngine
{
public:
    // Loop sizes in beats: 1/16 beat ... 16 bars (4/4).
    static constexpr int numSizes = 11;
    static constexpr double sizesBeats[numSizes] = { 1.0 / 16, 1.0 / 8, 1.0 / 4, 1.0 / 2, 1, 2, 4, 8, 16, 32, 64 };
    static constexpr int maxSizeIndex = numSizes - 1;

    struct Params
    {
        bool   loopOn       = false;
        bool   slip         = true;   // true = drop back on the live beat when loop exits
        bool   quantize     = true;   // snap loop end to the last beat boundary
        int    defaultIndex = 8;      // index into sizesBeats used on engage (8 = 4 bars)
        int    halveCount   = 0;      // monotonically increasing trigger counters
        int    doubleCount  = 0;
    };

    struct HostInfo
    {
        double bpm        = 120.0;
        bool   hasPpq     = false;
        double ppq        = 0.0;      // ppq at the first sample of this block
        bool   isPlaying  = false;
    };

    void prepare (double sampleRate, int numChannels, double minBpmForSizing = 60.0)
    {
        sr = sampleRate;
        channels = std::max (1, numChannels);

        // Hold 16 bars at minBpm, plus crossfade pre-roll and safety margin.
        const double maxLoopSamples = sizesBeats[maxSizeIndex] * sr * 60.0 / minBpmForSizing;
        capacity = (int64_t) std::ceil (maxLoopSamples + sr * 2.0);

        ring.assign ((size_t) channels, std::vector<float> ((size_t) capacity, 0.0f));
        loopBuf.assign ((size_t) channels, std::vector<float> ((size_t) capacity, 0.0f));

        loopXfade  = std::max (16.0, sr * 0.004);  // 4 ms boundary crossfade
        transXfade = std::max (16, (int) (sr * 0.005)); // 5 ms state-change crossfade

        reset();
    }

    void reset()
    {
        t = 0;
        written = 0;
        cur = State{};
        prev = State{};
        xfadeRemaining = 0;
        lastHalve = lastDouble = -1;
        wasLoopOn = false;
        wasSlip = true;
        sizeIndex.store (8);
        active.store (false);
        for (auto& c : ring)    std::fill (c.begin(), c.end(), 0.0f);
        for (auto& c : loopBuf) std::fill (c.begin(), c.end(), 0.0f);
    }

    // In-place processing. channelData[ch][i] holds input on entry, output on exit.
    void process (float* const* channelData, int numChannels, int numSamples,
                  const Params& p, const HostInfo& host)
    {
        if (capacity == 0 || numSamples <= 0)
            return;

        const int nch = std::min (numChannels, channels);
        const double bpm = (host.bpm > 1.0 && host.bpm < 1000.0) ? host.bpm : 120.0;
        spb = sr * 60.0 / bpm;

        // 1) Record the input block into the ring before rendering anything.
        for (int i = 0; i < numSamples; ++i)
        {
            const auto idx = (size_t) wrap (written + i);
            for (int ch = 0; ch < nch; ++ch)
                ring[(size_t) ch][idx] = channelData[ch][i];
        }
        written += numSamples;

        // 2) Apply control changes at block start (block-accurate is ~1-3 ms).
        if (lastHalve < 0)  lastHalve  = p.halveCount;
        if (lastDouble < 0) lastDouble = p.doubleCount;

        if (p.loopOn && ! wasLoopOn)
            engage (p, host);
        else if (! p.loopOn && wasLoopOn)
            exitLoop (p.slip);
        wasLoopOn = p.loopOn;

        // Halve / double act on the running loop only; idle, the readout shows the default size.
        if (p.halveCount != lastHalve)
        {
            if (cur.looping)
                resize (sizeIndex.load() - 1);
            lastHalve = p.halveCount;
        }

        if (p.doubleCount != lastDouble)
        {
            if (cur.looping)
                resize (sizeIndex.load() + 1);
            lastDouble = p.doubleCount;
        }

        // Turning slip back on while in "continue" mode resyncs to the live beat.
        if (p.slip && ! wasSlip && ! cur.looping && cur.D > 0.5)
            transitionTo (State{});
        wasSlip = p.slip;

        if (! cur.looping)
            sizeIndex.store (std::clamp (p.defaultIndex, 0, maxSizeIndex));

        // 3) Render.
        for (int i = 0; i < numSamples; ++i)
        {
            const int64_t now = t + i;
            for (int ch = 0; ch < nch; ++ch)
            {
                float out = render (cur, now, ch);
                if (xfadeRemaining > 0)
                {
                    const double x = 1.0 - (double) xfadeRemaining / (double) transXfade; // 0 -> 1
                    const float  o = render (prev, now, ch);
                    out = (float) (std::sin (x * halfPi) * out + std::cos (x * halfPi) * o);
                }
                channelData[ch][i] = out;
            }
            if (xfadeRemaining > 0)
                --xfadeRemaining;
        }
        t += numSamples;

        active.store (cur.looping);
    }

    // UI / host readouts (thread-safe).
    bool isLooping() const       { return active.load(); }
    int  currentSizeIndex() const { return sizeIndex.load(); }
    double getSampleRate() const { return sr; }

    static const char* sizeLabel (int index)
    {
        static const char* labels[numSizes] = { "1/16 BEAT", "1/8 BEAT", "1/4 BEAT", "1/2 BEAT", "1 BEAT",
                                                 "2 BEATS", "1 BAR", "2 BARS", "4 BARS", "8 BARS", "16 BARS" };
        return labels[std::clamp (index, 0, numSizes - 1)];
    }

private:
    struct State
    {
        bool   looping = false;
        double D = 0.0;   // output -> source offset
        double A = 0.0;   // loop start (source samples)
        double L = 0.0;   // loop length (samples)
    };

    static constexpr double halfPi = 1.57079632679489661923;

    int64_t wrap (int64_t i) const
    {
        const int64_t m = i % capacity;
        return m < 0 ? m + capacity : m;
    }

    // Oldest source sample still guaranteed intact in the ring.
    double oldestValid() const { return (double) std::max<int64_t> (0, written - capacity + 1); }

    double sourcePos (const State& s, int64_t now) const
    {
        const double rel = (double) now - s.D;
        if (! s.looping)
            return rel;
        double m = std::fmod (rel - s.A, s.L);
        if (m < 0) m += s.L;
        return s.A + m;
    }

    float readBuf (const std::vector<float>& buf, double pos) const
    {
        const double fl = std::floor (pos);
        const float  fr = (float) (pos - fl);
        const auto   i0 = (int64_t) fl;
        const float  a  = buf[(size_t) wrap (i0)];
        const float  b  = buf[(size_t) wrap (i0 + 1)];
        return a + fr * (b - a);
    }

    float render (const State& s, int64_t now, int ch) const
    {
        const auto& r = ring[(size_t) ch];
        if (! s.looping)
        {
            const double pos = (double) now - s.D;
            if (pos < oldestValid())
                return 0.0f;
            return readBuf (r, pos);
        }

        const auto& lb = loopBuf[(size_t) ch];
        const double pos = sourcePos (s, now);
        const double rel = pos - s.A;
        const double X   = std::min (loopXfade, s.L * 0.25);

        // Equal-power crossfade into the pre-roll so the wrap point is seamless.
        if (rel > s.L - X)
        {
            const double x = (rel - (s.L - X)) / X; // 0 -> 1
            return (float) (std::cos (x * halfPi) * readBuf (lb, pos)
                          + std::sin (x * halfPi) * readBuf (lb, pos - s.L));
        }
        return readBuf (lb, pos);
    }

    void copyToLoop (double from, double to)
    {
        const int64_t a = (int64_t) std::floor (from) - 2;
        const int64_t b = (int64_t) std::ceil (to) + 2;
        for (int ch = 0; ch < channels; ++ch)
            for (int64_t i = a; i < b; ++i)
                loopBuf[(size_t) ch][(size_t) wrap (i)] = ring[(size_t) ch][(size_t) wrap (i)];
    }

    // True when a loop starting at `start` (plus its crossfade pre-roll) is still intact in the ring.
    bool regionAvailable (double start) const
    {
        return start - loopXfade - 4.0 >= oldestValid();
    }

    void transitionTo (const State& next)
    {
        prev = cur;
        cur = next;
        xfadeRemaining = transXfade;
    }

    void engage (const Params& p, const HostInfo& host)
    {
        // End of loop in output time: last beat boundary (or now if no grid).
        double endOut = (double) t;
        if (p.quantize && host.hasPpq && host.isPlaying)
        {
            double frac = host.ppq - std::floor (host.ppq);
            if (frac > 0.999) frac = 0.0;
            endOut -= frac * spb;
        }

        const double endSrc = endOut - cur.D;

        int idx = std::clamp (p.defaultIndex, 0, maxSizeIndex);
        double L = sizesBeats[idx] * spb;
        while (idx > 0 && (! regionAvailable (endSrc - L) || L > (double) capacity * 0.5))
            L = sizesBeats[--idx] * spb;

        if (! regionAvailable (endSrc - L) || L < 8.0)
            return; // not enough history yet (plugin just loaded)

        State next;
        next.looping = true;
        next.D = cur.D;
        next.L = L;
        next.A = endSrc - L;

        copyToLoop (next.A - loopXfade, endSrc);
        sizeIndex.store (idx);
        transitionTo (next);
    }

    void exitLoop (bool slip)
    {
        if (! cur.looping)
            return;

        State next;
        if (! slip)
        {
            // Continue from where the loop playhead is (beat-aligned delay).
            next.D = (double) t - sourcePos (cur, t);
            if ((double) t - next.D - transXfade < oldestValid() + spb)
                next.D = 0.0; // history gone, fall back to live
        }
        transitionTo (next);
    }

    void resize (int newIndex)
    {
        newIndex = std::clamp (newIndex, 0, maxSizeIndex);
        const int oldIndex = sizeIndex.load();
        if (newIndex == oldIndex)
            return;

        State next = cur;
        next.L = cur.L * (sizesBeats[newIndex] / sizesBeats[oldIndex]);

        if (newIndex > oldIndex)
        {
            if (next.L > (double) capacity * 0.5)
                return;

            // Double: keep the loop start (Pioneer behaviour) when the audio after the
            // loop end is already recorded, otherwise keep the end and extend backwards.
            const double recordedEnd = (double) written - 2.0;
            if (cur.A + next.L <= recordedEnd && regionAvailable (cur.A))
            {
                copyToLoop (cur.A + cur.L - 1.0, cur.A + next.L);
            }
            else
            {
                next.A = cur.A + cur.L - next.L;
                if (! regionAvailable (next.A))
                    return;
                copyToLoop (next.A - loopXfade, cur.A + 1.0);
            }
        }
        // Halve: keep the loop start (Pioneer behaviour).

        if (next.L < 8.0)
            return;

        sizeIndex.store (newIndex);
        transitionTo (next);
    }

    double sr = 44100.0;
    int channels = 2;
    int64_t capacity = 0;
    std::vector<std::vector<float>> ring, loopBuf;

    double  spb = 22050.0;
    double  loopXfade = 176.0;
    int     transXfade = 220;

    int64_t t = 0;
    int64_t written = 0;
    State   cur, prev;
    int     xfadeRemaining = 0;

    int  lastHalve = -1, lastDouble = -1;
    bool wasLoopOn = false, wasSlip = true;

    std::atomic<int>  sizeIndex { 8 };
    std::atomic<bool> active { false };
};
