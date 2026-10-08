# Changelog

## 0.1.0 (unreleased)

- First version: the Annotations plugin for wavesurfer.js 7.10 and 8, which
  shows annotations without making or editing them.
  - Draws a box on the spectrogram for each annotation bounded in frequency,
    on wavesurfer.js's Spectrogram plugin or on wavesurfer-tiled-spectrogram's
    tiles, following the one on screen when tiles hand over.
  - Shows each annotation's span of time as a region with the Regions plugin,
    kept to the waveform where the annotation has a box.
  - Takes bounds as `start`, `end`, `low` and `high`, or by their Audiovisual
    Core names; a missing frequency bound runs to the edge of the spectrogram.
  - Marks bounds beyond the frequencies shown, and shows a box wholly beyond
    them as a strip along that edge.
  - `getFrequencyView()` and the `view` event, so that a page can draw its
    frequency axis from the same figures as the boxes. The view is given as
    soon as it is known: from tiles, before the audio has arrived.
  - Labels run on past narrow boxes as far as the next box, so they never
    cover one another. How they look comes from a stylesheet in wavesurfer.js's
    shadow DOM, which a page overrides with `::part(annotation-label)`.
  - Builds as an ES module and a UMD script, both using the page's own
    wavesurfer.js.
- The demo shows xeno-canto recordings and their annotations from the
  audioBLAST! API.
