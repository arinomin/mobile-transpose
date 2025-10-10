export const STEPS_COUNT = 16;
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const OCTAVES = [1, 2, 3, 4, 5, 6, 7];
export const WAVEFORMS = {
    'sine': 'Sine',
    'square': 'Square',
    'sawtooth': 'Saw',
    'triangle': 'Triangle'
};
export const MAJOR_TICKS = [-12, -7, 0, 7, 12];
export const INTERVAL_NAMES = {
    '-12': 'Octave Down', '-7': 'Perfect 5th Down', '0': 'Unison', '7': 'Perfect 5th Up', '12': 'Octave Up',
};
export const BPM_MIN = 40;
export const BPM_MAX = 280;
export const SCALES = {
    'major': [0, 2, 4, 5, 7, 9, 11],
    'minor': [0, 2, 3, 5, 7, 8, 10],
    'majorPentatonic': [0, 2, 4, 7, 9],
    'minorPentatonic': [0, 3, 5, 7, 10]
};
export const SHARE_FORMAT_VERSION = 'v5';
export const RATES = [4, 3, 2, 1.5, 1, 0.5, 0.25];
export const WAVE_SERIALIZE_MAP = { 'sine': 's', 'square': 'q', 'sawtooth': 'w', 'triangle': 't' };
export const WAVE_DESERIALIZE_MAP = { 's': 'sine', 'q': 'square', 'w': 'sawtooth', 't': 'triangle' };


export const state = {
    audioContext: null,
    masterGainNode: null,
    bpm: 120,
    rate: 4,
    baseNote: 'C',
    baseOctave: 4,
    waveform: 'sawtooth', // Default waveform
    seqMax: STEPS_COUNT,
    pendingSeqMax: null, // For seamless seqMax change
    steps: Array(STEPS_COUNT).fill(0).map(() => ({ transpose: 0, enabled: true })),
    currentStep: 0,
    isPlaying: false, // Covers both main and preview playback
    playbackMode: 'main', // 'main' or 'preview'
    editedStepIndex: null,
    
    // Scheduler State
    nextNoteTime: 0.0,
    scheduleAheadTime: 0.1, // How far ahead to schedule audio (sec)
    schedulerLookahead: 25.0, // How often to call scheduler function (ms)
    schedulerTimerId: null,
    lastStepDrawn: -1,
    notesInQueue: [],

    // Temporary modal states
    modalBpm: 120,
    modalRate: 4,
    modalRateText: '16分',
    modalBaseNote: 'C',
    modalBaseOctave: 4,
    modalWaveform: 'sawtooth',

    // Melody Generation State
    previewSteps: null,
};
