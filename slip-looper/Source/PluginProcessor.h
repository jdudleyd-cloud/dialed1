#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include "LoopEngine.h"

namespace ParamIDs
{
    inline constexpr auto loopOn        = "loopOn";
    inline constexpr auto halve         = "halve";
    inline constexpr auto doubleLoop    = "double";
    inline constexpr auto defaultLength = "defaultLength";
    inline constexpr auto slip          = "slip";
    inline constexpr auto quantize      = "quantize";
}

class SlipLoopProcessor : public juce::AudioProcessor,
                          private juce::Timer
{
public:
    SlipLoopProcessor();
    ~SlipLoopProcessor() override;

    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override {}
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    using AudioProcessor::processBlock;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return JucePlugin_Name; }
    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return {}; }
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    // Editor helpers
    juce::AudioProcessorValueTreeState apvts;
    bool isLooping() const          { return engine.isLooping(); }
    int  currentSizeIndex() const   { return engine.currentSizeIndex(); }
    double currentBpm() const       { return lastBpm.load(); }
    void triggerMomentary (const char* paramID);

private:
    static juce::AudioProcessorValueTreeState::ParameterLayout createLayout();
    void timerCallback() override;

    LoopEngine engine;
    LoopEngine::Params engineParams;

    std::atomic<float>* loopOnParam   = nullptr;
    std::atomic<float>* halveParam    = nullptr;
    std::atomic<float>* doubleParam   = nullptr;
    std::atomic<float>* defaultParam  = nullptr;
    std::atomic<float>* slipParam     = nullptr;
    std::atomic<float>* quantizeParam = nullptr;

    bool lastHalveHigh = false, lastDoubleHigh = false;
    std::atomic<bool> resetHalve { false }, resetDouble { false };
    std::atomic<double> lastBpm { 120.0 };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (SlipLoopProcessor)
};
