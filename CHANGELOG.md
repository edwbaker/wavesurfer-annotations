# Changelog

## Unreleased

- The `fillOpacity` option sets how deep a box's fill is at rest, from 0 to 1.
  The default, 0.12, is as before. Under the mouse a box's fill is 0.3, or its
  fill at rest if that is deeper.

## 0.2.0 (2026-10-21)

- The `row` option draws an instance's regions on one row of a waveform split by
  channel, and its boxes on that row of split tiles. Without it, a region spans
  the whole waveform, as before.
- An annotation may name its `channel` (from 0, as the tiles count them): it is
  then drawn only on that channel's row, or where that channel is the one shown.
  Without a channel it is drawn on every row, as before.
- The Spectrogram plugin's element is found by its place among the waveform's
  children, not by a canvas, which wavesurfer.js 8 may not have drawn yet when it
  says it is ready. That gap caused the "element could not be found" warning in
  windowed rendering, and the boxes went missing until the next layout.

## 0.1.1 (2026-10-09)

- The README gives `npm install` again: 0.1.0's, which npm shows, said the
  plugin was not on npm yet. The plugin itself is as in 0.1.0.

## 0.1.0 (2026-10-09)

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
