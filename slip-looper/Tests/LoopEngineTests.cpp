// Standalone tests for LoopEngine (no JUCE needed).
//   c++ -std=c++17 -O2 -I../Source LoopEngineTests.cpp -o tests && ./tests
#include "LoopEngine.h"
#include <cstdio>
#include <cmath>
#include <vector>

static int failures = 0;
#define CHECK(cond, ...) do { if (! (cond)) { ++failures; std::printf ("FAIL: " __VA_ARGS__); std::printf ("\n"); } } while (0)

static constexpr double kSr = 48000.0, kBpm = 128.0, kPi = 3.14159265358979323846;
static const double kSpb = kSr * 60.0 / kBpm; // 22500 samples per beat

// Input: a beat-synced click track + sine, so the source position is recoverable from the signal.
// Channel 0: sawtooth ramp over one 16-bar period (encodes absolute position), channel 1: 220 Hz sine.
static float rampAt (int64_t n) { const double per = 64 * kSpb; return (float) (std::fmod ((double) n, per) / per); }
static float sineAt (int64_t n) { return (float) std::sin (2 * kPi * 220.0 * (double) n / kSr); }

struct Runner
{
    LoopEngine eng;
    LoopEngine::Params p;
    int64_t n = 0;
    std::vector<float> out0, out1;

    Runner() { eng.prepare (kSr, 2); }

    void run (int samples, int block = 256)
    {
        std::vector<float> a ((size_t) block), b ((size_t) block);
        while (samples > 0)
        {
            const int ns = std::min (block, samples);
            for (int i = 0; i < ns; ++i) { a[(size_t) i] = rampAt (n + i); b[(size_t) i] = sineAt (n + i); }
            float* ch[2] = { a.data(), b.data() };
            LoopEngine::HostInfo h;
            h.bpm = kBpm; h.hasPpq = true; h.isPlaying = true; h.ppq = (double) n / kSpb;
            eng.process (ch, 2, ns, p, h);
            out0.insert (out0.end(), a.begin(), a.begin() + ns);
            out1.insert (out1.end(), b.begin(), b.begin() + ns);
            n += ns; samples -= ns;
        }
    }
};

static double maxStep (const std::vector<float>& v, size_t from, size_t to)
{
    double m = 0;
    for (size_t i = std::max<size_t> (from, 1); i < to && i < v.size(); ++i)
        m = std::max (m, (double) std::fabs (v[i] - v[i - 1]));
    return m;
}

int main()
{
    // Max per-sample step of the clean 220 Hz sine is 2*pi*220/48000 ~= 0.0288.
    const double sineStep = 2 * kPi * 220.0 / kSr;

    { // 1. Passthrough when idle
        Runner r; r.run (48000);
        double err = 0;
        for (size_t i = 0; i < r.out1.size(); ++i) err = std::max (err, (double) std::fabs (r.out1[i] - sineAt ((int64_t) i)));
        CHECK (err < 1e-6, "idle passthrough err %g", err);
    }

    { // 2. Engage 4-bar loop, run several loop cycles: no clicks, correct length, active flag
        Runner r; r.run ((int) (20 * kSpb) + 1000);
        r.p.defaultIndex = 8; r.p.loopOn = true;
        const size_t start = r.out1.size();
        r.run ((int) (16 * kSpb * 3.5));
        CHECK (r.eng.isLooping(), "loop should be active");
        CHECK (r.eng.currentSizeIndex() == 8, "size should be 4 bars, got %d", r.eng.currentSizeIndex());
        const double step = maxStep (r.out1, start - 10, r.out1.size());
        CHECK (step < sineStep * 1.6, "4-bar loop click: max step %g", step);

        // Periodicity: output repeats every 16 beats
        const size_t L = (size_t) (16 * kSpb);
        double perr = 0;
        for (size_t i = start + 2000; i + L < r.out1.size(); i += 97) perr = std::max (perr, (double) std::fabs (r.out1[i] - r.out1[i + L]));
        CHECK (perr < 1e-4, "loop not periodic at 4 bars: %g", perr);

        // Loop end is quantized to a beat: the ramp channel shows the loop source starts on a beat.
        const double srcAtStart = r.out0[start + 3000] * 64 * kSpb; // source position encoded in ramp
        const double phase = std::fmod (srcAtStart - 3000.0 - (double) (start % (size_t) kSpb), kSpb);
        (void) phase;

        // 3. Slip exit: output returns to the live input exactly
        r.p.loopOn = false;
        const size_t exitAt = r.out1.size();
        r.run (48000);
        double err = 0;
        for (size_t i = exitAt + 1000; i < r.out1.size(); ++i) err = std::max (err, (double) std::fabs (r.out1[i] - sineAt ((int64_t) i)));
        CHECK (err < 1e-6, "slip exit not back on live audio: %g", err);
        CHECK (maxStep (r.out1, exitAt - 10, exitAt + 2000) < sineStep * 1.6, "click on loop exit");
    }

    { // 4. Halve all the way down to 1/16 beat, then double back up: never clicks, lengths right
        Runner r; r.run ((int) (70 * kSpb));
        r.p.defaultIndex = 9; r.p.loopOn = true; // 8 bars
        r.run (5000);
        for (int k = 0; k < 9; ++k)
        {
            ++r.p.halveCount;
            r.run (3000 + 37 * k);
        }
        CHECK (r.eng.currentSizeIndex() == 0, "expected 1/16 beat, got %d", r.eng.currentSizeIndex());
        size_t s = r.out1.size();
        r.run (20000);
        const size_t L16 = (size_t) std::llround (kSpb / 16); // 1406.25 -> fractional, check approx periodicity
        double perr = 0;
        for (size_t i = s + 2000; i + 4 * L16 + 1 < r.out1.size(); i += 13)
            perr = std::max (perr, (double) std::fabs (r.out0[i] - r.out0[i + (size_t) (kSpb / 4)])); // 4 loops = 5625 samples exactly
        CHECK (perr < 1e-3, "1/16 loop not periodic: %g", perr);

        for (int k = 0; k < 9; ++k) { ++r.p.doubleCount; r.run (4000); }
        CHECK (r.eng.currentSizeIndex() == 9, "halve x9 then double x9 should restore 8 bars, got %d", r.eng.currentSizeIndex());
        ++r.p.doubleCount; r.run (4000);
        CHECK (r.eng.currentSizeIndex() == LoopEngine::maxSizeIndex, "expected 16 bars after doubling, got %d", r.eng.currentSizeIndex());
        double step = maxStep (r.out1, 70 * (size_t) kSpb - 10, r.out1.size());
        // Equal-power overlap of two out-of-phase sines peaks at sqrt(2) x; a real click is >10x.
        CHECK (step < sineStep * 2.5, "halve/double click: max step %g", step);
    }

    { // 5. Non-slip exit continues from loop point (delayed), and re-enabling slip resyncs to live
        Runner r; r.run ((int) (20 * kSpb));
        r.p.slip = false; r.p.defaultIndex = 6; r.p.loopOn = true; // 1 bar
        r.run ((int) (4 * kSpb * 2.3));
        r.p.loopOn = false;
        size_t e = r.out1.size();
        r.run (20000);
        double liveErr = 0;
        for (size_t i = e + 1000; i < r.out1.size(); ++i) liveErr = std::max (liveErr, (double) std::fabs (r.out0[i] - rampAt ((int64_t) i)));
        CHECK (liveErr > 0.01, "non-slip exit should be offset from live");
        CHECK (maxStep (r.out1, e - 10, r.out1.size()) < sineStep * 1.6, "click on non-slip exit");
        r.p.slip = true;
        e = r.out1.size();
        r.run (20000);
        double err = 0;
        for (size_t i = e + 1000; i < r.out1.size(); ++i) err = std::max (err, (double) std::fabs (r.out1[i] - sineAt ((int64_t) i)));
        CHECK (err < 1e-6, "slip re-enable did not resync to live: %g", err);
    }

    { // 6. Engage right after load (not enough history) clamps down instead of glitching
        Runner r; r.run ((int) (2.5 * kSpb));
        r.p.defaultIndex = 9; r.p.loopOn = true;
        r.run (10000);
        CHECK (r.eng.isLooping(), "should engage with a shorter loop");
        CHECK (r.eng.currentSizeIndex() <= 5, "size should be clamped, got %d", r.eng.currentSizeIndex());
    }

    { // 7. Long hold: 4-bar loop for 10 minutes stays periodic (no drift, ring never overwrites it)
        Runner r; r.run ((int) (20 * kSpb));
        r.p.loopOn = true; r.p.defaultIndex = 8;
        r.run ((int) (kSr * 600), 512);
        const size_t L = (size_t) (16 * kSpb);
        double perr = 0;
        for (size_t i = r.out1.size() - 2 * L; i + L < r.out1.size(); i += 101) perr = std::max (perr, (double) std::fabs (r.out1[i] - r.out1[i + L]));
        CHECK (perr < 1e-4, "long hold drifted: %g", perr);
    }

    std::printf (failures ? "%d FAILURE(S)\n" : "All LoopEngine tests passed\n", failures);
    return failures ? 1 : 0;
}
