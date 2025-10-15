import { state, STEPS_COUNT, SCALES, NOTE_NAMES } from './state.js';
import * as actions from './actions.js';
import { domElements } from './ui.js';
import { startPlayback } from './audio.js';
import { noteToMidi } from './utils.js';

export function generateAndPreviewMelody() {
    const key = domElements.melodyKeySelect.value;
    const scaleName = domElements.melodyScaleSelect.value;
    const scaleIntervals = SCALES[scaleName];

    const rootNoteIndex = NOTE_NAMES.indexOf(key);
    const baseMidi = noteToMidi(state.baseNote, state.baseOctave);

    const transposePool = [];
    const octaveRange = state.melodyGenAlgorithm === 'leaps-and-rests' ? 2 : 1;
    for (let octave = -octaveRange; octave <= octaveRange; octave++) {
        for (const interval of scaleIntervals) {
            const midiNote = rootNoteIndex + (state.baseOctave + octave) * 12 + interval;
            transposePool.push(midiNote - baseMidi);
        }
    }
    const uniqueTransposes = [...new Set(transposePool)].sort((a, b) => a - b);

    let currentIndex = uniqueTransposes.indexOf(
        uniqueTransposes.reduce((prev, curr) => Math.abs(curr) < Math.abs(prev) ? curr : prev, Infinity)
    );

    const newMelody = [];
    for (let i = 0; i < STEPS_COUNT; i++) {
        const isRest = Math.random() < state.melodyGenRestProbability;
        if (isRest) {
            newMelody.push({ transpose: uniqueTransposes[currentIndex], enabled: false });
        } else {
            newMelody.push({ transpose: uniqueTransposes[currentIndex], enabled: true });

            if (state.melodyGenAlgorithm === 'simple-walk') {
                const randomChoice = Math.random();
                if (randomChoice < 0.2) { 
                } else if (randomChoice < 0.6) {
                    currentIndex = Math.min(uniqueTransposes.length - 1, currentIndex + 1);
                } else {
                    currentIndex = Math.max(0, currentIndex - 1);
                }
            } else { 
                const randomChoice = Math.random();
                let nextIndex;
                if (randomChoice < 0.5) {
                    const direction = Math.random() < 0.5 ? -1 : 1;
                    nextIndex = currentIndex + direction;
                } else {
                    const leapSize = Math.floor(Math.random() * 4) + 2;
                    const direction = Math.random() < 0.5 ? -1 : 1;
                    nextIndex = currentIndex + (leapSize * direction);
                }
                currentIndex = Math.max(0, Math.min(uniqueTransposes.length - 1, nextIndex));
            }
        }
    }

    actions.setPreviewMelody(newMelody);
    domElements.applyMelodyButton.disabled = false;
    startPlayback('preview');
}
