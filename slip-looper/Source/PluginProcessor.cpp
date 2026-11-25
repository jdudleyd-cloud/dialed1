#include "PluginProcessor.h"
#include "PluginEditor.h"

SlipLoopProcessor::SlipLoopProcessor()
    : AudioProcessor (BusesProperties()
                        .withInput  ("Input",  juce::AudioChannelSet::stereo(), true)
                        .withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      apvts (*this, nullptr, "SlipLoopState", createLayout())
{
    loopOnParam   = apvts.getRawParameterValue (ParamIDs::loopOn);
    halveParam    = apvts.getRawParameterValue (ParamIDs::halve);
    doubleParam   = apvts.getRawParameterValue (ParamIDs::doubleLoop);
    defaultParam  = apvts.getRawParameterValue (ParamIDs::defaultLength);
    slipParam     = apvts.getRawParameterValue (ParamIDs::slip);
    quantizeParam = apvts.getRawParameterValue (ParamIDs::quantize);

    startTimerHz (50); // resets the momentary Halve/Double params back to Off
}

SlipLoopProcessor::~SlipLoopProcessor()
{
    stopTimer();
}

juce::AudioProcessorValueTreeState::ParameterLayout SlipLoopProcessor::createLayout()
{
    using namespace juce;
    AudioProcessorValueTreeState::ParameterLayout layout;

    layout.add (std::make_unique<AudioParameterBool>   (ParameterID { ParamIDs::loopOn, 1 },        "Loop On", false));
    layout.add (std::make_unique<AudioParameterBool>   (ParameterID { ParamIDs::halve, 1 },         "Halve Loop", false));
    layout.add (std::make_unique<AudioParameterBool>   (ParameterID { ParamIDs::doubleLoop, 1 },    "Double Loop", false));
    layout.add (std::make_unique<AudioParameterChoice> (ParameterID { ParamIDs::defaultLength, 1 }, "Default Length",
                                                        StringArray { "1 Bar", "2 Bars", "4 Bars", "8 Bars" }, 2));
    layout.add (std::make_unique<AudioParameterBool>   (ParameterID { ParamIDs::slip, 1 },          "Slip", true));
    layout.add (std::make_unique<AudioParameterBool>   (ParameterID { ParamIDs::quantize, 1 },      "Quantize", true));
    return layout;
}

bool SlipLoopProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    const auto out = layouts.getMainOutputChannelSet();
    if (out != juce::AudioChannelSet::mono() && out != juce::AudioChannelSet::stereo())
        return false;
    return layouts.getMainInputChannelSet() == out;
}

void SlipLoopProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    engine.prepare (sampleRate, juce::jmax (1, getTotalNumOutputChannels()));
    juce::ignoreUnused (samplesPerBlock);
    lastHalveHigh = halveParam->load() > 0.5f;
    lastDoubleHigh = doubleParam->load() > 0.5f;
}

void SlipLoopProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer&)
{
    juce::ScopedNoDenormals noDenormals;

    // Momentary triggers: act on the rising edge; the timer flips them back to Off so the
    // next APC40 press (Ableton toggles mapped bool params) is another rising edge.
    const bool halveHigh = halveParam->load() > 0.5f;
    if (halveHigh && ! lastHalveHigh) { ++engineParams.halveCount; resetHalve.store (true); }
    lastHalveHigh = halveHigh;

    const bool doubleHigh = doubleParam->load() > 0.5f;
    if (doubleHigh && ! lastDoubleHigh) { ++engineParams.doubleCount; resetDouble.store (true); }
    lastDoubleHigh = doubleHigh;

    engineParams.loopOn       = loopOnParam->load() > 0.5f;
    engineParams.slip         = slipParam->load() > 0.5f;
    engineParams.quantize     = quantizeParam->load() > 0.5f;
    engineParams.defaultIndex = 6 + juce::jlimit (0, 3, (int) defaultParam->load()); // 1,2,4,8 bars

    LoopEngine::HostInfo host;
    if (auto* ph = getPlayHead())
    {
        if (const auto pos = ph->getPosition())
        {
            if (const auto bpm = pos->getBpm())         host.bpm = *bpm;
            if (const auto ppq = pos->getPpqPosition()) { host.ppq = *ppq; host.hasPpq = true; }
            host.isPlaying = pos->getIsPlaying();
        }
    }
    lastBpm.store (host.bpm);

    for (int ch = getTotalNumInputChannels(); ch < getTotalNumOutputChannels(); ++ch)
        buffer.clear (ch, 0, buffer.getNumSamples());

    engine.process (buffer.getArrayOfWritePointers(), buffer.getNumChannels(),
                    buffer.getNumSamples(), engineParams, host);
}

void SlipLoopProcessor::timerCallback()
{
    auto resetParam = [this] (const char* id, std::atomic<bool>& flag)
    {
        if (flag.exchange (false))
            if (auto* p = apvts.getParameter (id))
                if (p->getValue() > 0.5f)
                    p->setValueNotifyingHost (0.0f);
    };
    resetParam (ParamIDs::halve, resetHalve);
    resetParam (ParamIDs::doubleLoop, resetDouble);
}

void SlipLoopProcessor::triggerMomentary (const char* paramID)
{
    if (auto* p = apvts.getParameter (paramID))
    {
        p->beginChangeGesture();
        p->setValueNotifyingHost (1.0f);
        p->endChangeGesture();
    }
}

juce::AudioProcessorEditor* SlipLoopProcessor::createEditor()
{
    return new SlipLoopEditor (*this);
}

void SlipLoopProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    auto state = apvts.copyState();
    if (auto xml = state.createXml())
        copyXmlToBinary (*xml, destData);
}

void SlipLoopProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    if (auto xml = getXmlFromBinary (data, sizeInBytes))
        if (xml->hasTagName (apvts.state.getType()))
            apvts.replaceState (juce::ValueTree::fromXml (*xml));

    // Never reopen a set with the loop engaged or a trigger stuck on.
    for (auto id : { ParamIDs::loopOn, ParamIDs::halve, ParamIDs::doubleLoop })
        if (auto* p = apvts.getParameter (id))
            p->setValueNotifyingHost (0.0f);
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new SlipLoopProcessor();
}
