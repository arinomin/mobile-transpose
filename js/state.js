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
    'harmonicMinor': [0, 2, 3, 5, 7, 8, 11],
    'dorian': [0, 2, 3, 5, 7, 9, 10],
    'mixolydian': [0, 2, 4, 5, 7, 9, 10],
    'majorPentatonic': [0, 2, 4, 7, 9],
    'minorPentatonic': [0, 3, 5, 7, 10],
    'blues': [0, 3, 5, 6, 7, 10]
};
export const SHARE_FORMAT_VERSION = 'v5';
export const RATES = [4, 3, 2, 1.5, 1, 0.5, 0.25];
export const WAVE_SERIALIZE_MAP = { 'sine': 's', 'square': 'q', 'sawtooth': 'w', 'triangle': 't' };
export const WAVE_DESERIALIZE_MAP = { 's': 'sine', 'q': 'square', 'w': 'sawtooth', 't': 'triangle' };

export const helpContent = {
    key: {
        title: {
            en: "Key",
            ja: "キー (調)"
        },
        content: {
            en: "The root note of the scale used for melody generation. The generated melody will be centered around this key.",
            ja: "メロディー生成の基準となるスケールのルート音です。生成されるメロディーはこのキーを中心に構成されます。"
        }
    },
    scale: {
        title: {
            en: "Scale",
            ja: "スケール (音階)"
        },
        content: {
            en: "The set of notes that the melody generator will use. Different scales create different moods (e.g., Major for happy, Minor for sad).",
            ja: "メロディー生成に使用される音のグループです。スケールによってメロディーの雰囲気（例：メジャーは明るい、マイナーは悲しい）が変わります。"
        }
    },
    algorithm: {
        title: {
            en: "Algorithm",
            ja: "アルゴリズム"
        },
        content: {
            en: "'Simple Walk' creates a smooth melody by moving one step at a time. 'Leaps & Rests' creates a more dynamic melody with larger jumps and occasional silence.",
            ja: "「Simple Walk」は一歩ずつ動く滑らかなメロディーを生成します。「Leaps & Rests」は大きな跳躍や時々の休符を伴う、よりダイナミックなメロディーを生成します。"
        }
    },
    'rest-probability': {
        title: {
            en: "Rest Probability",
            ja: "休符の確率"
        },
        content: {
            en: "The chance that a step will be a rest (silent). Higher values will result in more silence and a more sparse melody.",
            ja: "各ステップが休符（無音）になる確率です。値を高くすると、休符が増え、よりまばらなメロディーになります。"
        }
    },
    waveform: {
        title: {
            en: "Waveform",
            ja: "波形"
        },
        content: {
            en: "Determines the basic timbre of the sound. 'Sine' is pure and soft. 'Square' is bright and retro, like a video game. 'Saw' is rich and buzzy. 'Triangle' is mellow and flute-like.",
            ja: "音の基本的な音色を決定します。「Sine」は純粋で柔らかい音、「Square」はビデオゲームのような明るくレトロな音、「Saw」は豊かで鋭い音、「Triangle」はまろやかでフルートのような音です。"
        }
    },
    rate: {
        title: {
            en: "Rate",
            ja: "レート"
        },
        content: {
            en: "Sets the speed of the sequence relative to the BPM. '16分' (16th notes) is four notes per beat. '8分' (8th notes) is two notes per beat. '1拍3連' (Triplets) fits three notes into one beat.",
            ja: "BPMに対するシーケンスの速さを設定します。「16分」は1拍に4つの音、「8分」は1拍に2つの音を演奏します。「1拍3連」は1拍の長さに3つの音を均等に配置します。"
        }
    },
    general: {
        title: {
            en: "How to Use",
            ja: "基本的な使い方"
        },
        content: {
            en: `This is a 16-step sequencer.\n\n- Sequencer Grid: Click a step to edit its pitch. Drag and drop to swap step positions.\n- Global Controls: Tap 'Base Note' or 'BPM / Rate' to change the overall sound and tempo.\n- Footer Menu: Generate new melodies, Play/Stop the sequence, or Share your creation with a URL.`,
            ja: `このアプリは16ステップのシーケンサーです。\n\n・シーケンサーグリッド: 各ステップをクリックすると音程を編集できます。ドラッグ＆ドロップすると、ステップの位置を入れ替えられます。\n・グローバルコントロール: 「Base Note」や「BPM / Rate」をタップすると、全体のサウンドやテンポを変更できます。\n・フッターメニュー: 新しいメロディーを生成したり、再生/停止、URLでの共有ができます。`
        }
    }
};


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
    melodyGenAlgorithm: 'simple-walk',
    melodyGenRestProbability: 0,
};
