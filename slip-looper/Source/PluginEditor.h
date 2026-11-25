#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_gui_basics/juce_gui_basics.h>
#include "PluginProcessor.h"

class SlipLoopEditor : public juce::AudioProcessorEditor,
                       private juce::Timer
{
public:
    explicit SlipLoopEditor (SlipLoopProcessor&);
    ~SlipLoopEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    void timerCallback() override;

    SlipLoopProcessor& proc;

    juce::TextButton loopButton { "LOOP" }, halveButton { "1/2" }, doubleButton { "x2" };
    juce::TextButton slipButton { "SLIP" }, quantButton { "QUANT" };
    juce::ComboBox   lengthBox;

    using ButtonAttachment = juce::AudioProcessorValueTreeState::ButtonAttachment;
    using ComboAttachment  = juce::AudioProcessorValueTreeState::ComboBoxAttachment;
    std::unique_ptr<ButtonAttachment> loopAtt, slipAtt, quantAtt;
    std::unique_ptr<ComboAttachment>  lengthAtt;

    bool shownLooping = false;
    int  shownSize = -1;
    double shownBpm = 0.0;

    juce::Rectangle<int> readoutArea;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (SlipLoopEditor)
};
