import { NOTE_NAMES } from './state.js';

/**
 * Converts a note name and octave to a MIDI note number.
 * @param {string} note - The note name (e.g., 'C', 'C#').
 * @param {number} octave - The octave number.
 * @returns {number} The MIDI note number.
 */
export function noteToMidi(note, octave) {
    const noteIndex = NOTE_NAMES.indexOf(note);
    return noteIndex + (octave + 1) * 12;
}

/**
 * Converts a MIDI note number to a frequency in Hz.
 * @param {number} midi - The MIDI note number.
 * @returns {number} The frequency in Hz.
 */
export function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Converts a MIDI note number to a note name with octave.
 * @param {number} midi - The MIDI note number.
 * @returns {string} The note name with octave (e.g., 'C4').
 */
export function getNoteName(midi) {
    const octave = Math.floor(midi / 12) - 1;
    const noteIndex = midi % 12;
    return NOTE_NAMES[noteIndex] + octave;
}

/**
 * Formats a transpose value with a '+' sign for positive numbers.
 * @param {number} transpose - The transpose value.
 * @returns {string} The formatted transpose value.
 */
export function formatTranspose(transpose) {
    return transpose >= 0 ? `+${transpose}` : transpose;
}
