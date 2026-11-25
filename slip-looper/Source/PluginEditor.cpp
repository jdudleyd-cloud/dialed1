#include "PluginEditor.h"

namespace
{
    const juce::Colour bg       { 0xff0e0f12 };
    const juce::Colour panel    { 0xff17191e };
    const juce::Colour dim      { 0xff5a5f6b };
    const juce::Colour text     { 0xffe8eaee };
    const juce::Colour active   { 0xff27e07a }; // loop-active green
    const juce::Colour accent   { 0xffff8a1f }; // orange for toggles

    void styleButton (juce::TextButton& b, juce::Colour onColour)
    {
        b.setColour (juce::TextButton::buttonColourId,   juce::Colour (0xff23262d));
        b.setColour (juce::TextButton::buttonOnColourId, onColour);
        b.setColour (juce::TextButton::textColourOffId,  text);
        b.setColour (juce::TextButton::textColourOnId,   juce::Colours::black);
    }
}

SlipLoopEditor::SlipLoopEditor (SlipLoopProcessor& p)
    : AudioProcessorEditor (&p), proc (p)
{
    for (auto* b : { &loopButton, &halveButton, &doubleButton, &slipButton, &quantButton })
    {
        styleButton (*b, b == &loopButton ? active : accent);
        addAndMakeVisible (*b);
    }

    loopButton.setClickingTogglesState (true);
    slipButton.setClickingTogglesState (true);
    quantButton.setClickingTogglesState (true);

    halveButton.onClick  = [this] { proc.triggerMomentary (ParamIDs::halve); };
    doubleButton.onClick = [this] { proc.triggerMomentary (ParamIDs::doubleLoop); };

    lengthBox.addItemList ({ "1 Bar", "2 Bars", "4 Bars", "8 Bars" }, 1);
    lengthBox.setColour (juce::ComboBox::backgroundColourId, juce::Colour (0xff23262d));
    lengthBox.setColour (juce::ComboBox::textColourId, text);
    lengthBox.setColour (juce::ComboBox::outlineColourId, juce::Colours::transparentBlack);
    addAndMakeVisible (lengthBox);

    loopAtt   = std::make_unique<ButtonAttachment> (proc.apvts, ParamIDs::loopOn, loopButton);
    slipAtt   = std::make_unique<ButtonAttachment> (proc.apvts, ParamIDs::slip, slipButton);
    quantAtt  = std::make_unique<ButtonAttachment> (proc.apvts, ParamIDs::quantize, quantButton);
    lengthAtt = std::make_unique<ComboAttachment>  (proc.apvts, ParamIDs::defaultLength, lengthBox);

    setSize (380, 230);
    startTimerHz (30);
}

SlipLoopEditor::~SlipLoopEditor()
{
    stopTimer();
}

void SlipLoopEditor::timerCallback()
{
    const bool looping = proc.isLooping();
    const int  size    = proc.currentSizeIndex();
    const double bpm   = proc.currentBpm();
    if (looping != shownLooping || size != shownSize || std::abs (bpm - shownBpm) > 0.01)
    {
        shownLooping = looping;
        shownSize = size;
        shownBpm = bpm;
        repaint();
    }
}

void SlipLoopEditor::paint (juce::Graphics& g)
{
    g.fillAll (bg);

    auto r = readoutArea.toFloat();
    g.setColour (panel);
    g.fillRoundedRectangle (r, 8.0f);
    if (shownLooping)
    {
        g.setColour (active.withAlpha (0.9f));
        g.drawRoundedRectangle (r.reduced (1.0f), 8.0f, 2.0f);
    }

    // Active LED
    auto led = juce::Rectangle<float> (14.0f, 14.0f).withPosition (r.getX() + 14.0f, r.getY() + 14.0f);
    g.setColour (shownLooping ? active : juce::Colour (0xff2c3038));
    g.fillEllipse (led);
    if (shownLooping)
    {
        g.setColour (active.withAlpha (0.25f));
        g.fillEllipse (led.expanded (5.0f));
    }

    g.setColour (shownLooping ? active : dim);
    g.setFont (juce::FontOptions (12.0f, juce::Font::bold));
    g.drawText (shownLooping ? "LOOP ACTIVE" : "READY", led.getRight() + 8.0f, led.getY() - 2.0f, 120.0f, 18.0f,
                juce::Justification::centredLeft);

    g.setColour (dim);
    g.drawText (juce::String (shownBpm, 1) + " BPM", r.getRight() - 110.0f, led.getY() - 2.0f, 96.0f, 18.0f,
                juce::Justification::centredRight);

    g.setColour (shownLooping ? text : text.withAlpha (0.55f));
    g.setFont (juce::FontOptions (44.0f, juce::Font::bold));
    g.drawText (LoopEngine::sizeLabel (shownSize), r.withTrimmedTop (30.0f).toNearestInt(), juce::Justification::centred);
}

void SlipLoopEditor::resized()
{
    auto area = getLocalBounds().reduced (12);
    readoutArea = area.removeFromTop (118);
    area.removeFromTop (10);

    auto row1 = area.removeFromTop (44);
    const int w = (row1.getWidth() - 16) / 3;
    halveButton.setBounds (row1.removeFromLeft (w));
    row1.removeFromLeft (8);
    loopButton.setBounds (row1.removeFromLeft (w));
    row1.removeFromLeft (8);
    doubleButton.setBounds (row1);

    area.removeFromTop (8);
    auto row2 = area.removeFromTop (30);
    lengthBox.setBounds (row2.removeFromLeft (w));
    row2.removeFromLeft (8);
    slipButton.setBounds (row2.removeFromLeft (w));
    row2.removeFromLeft (8);
    quantButton.setBounds (row2);
}
