import {
    state
} from './state.js';
import {
    domElements,
    openStepModal, closeStepModal, updateStepModalInfo,
    openBpmRateModal, closeBpmRateModal, applyBpmRateChanges, adjustBpm,
    openBaseNoteModal, closeBaseNoteModal, applyBaseNoteChanges,
    openMelodyGenModal, closeMelodyGenModal, generateAndPreviewMelody, applyMelody,
    openHelpModal, closeHelpModal,
    openShareModal, closeShareModal
} from './ui.js';
import { startPlayback, stopPlayback } from './audio.js';

export function setupEventListeners(serializeState) {

    function handlePlayStop() {
        if (state.isPlaying) {
            stopPlayback();
        } else {
            startPlayback('main');
        }
    }

    domElements.playStopBtn.addEventListener('click', handlePlayStop);
    domElements.melodyGenBtn.addEventListener('click', openMelodyGenModal);
    domElements.shareBtn.addEventListener('click', () => {
        const dataString = serializeState();
        const url = new URL(window.location.href);
        url.hash = encodeURIComponent(dataString);
        domElements.shareUrlInput.value = url.toString();
        openShareModal();
    });

    // --- Modal-specific Listeners ---

    // Step Modal
    domElements.stepModal.addEventListener('click', (e) => { if (e.target === domElements.stepModal) closeStepModal(); });
    domElements.closeModalBtn.addEventListener('click', closeStepModal);
    domElements.doneStepButton.addEventListener('click', closeStepModal);
    domElements.resetBtn.addEventListener('click', () => updateStepModalInfo(0, true));
    domElements.auditionBtn.addEventListener('click', () => {
        const percentage = parseFloat(domElements.transposeSelector.querySelector('.selector-handle').style.left) / 100;
        const transpose = Math.round(percentage * 24) - 12;
        // This calculation is duplicated from ui.js, should be refactored later
        const noteIndex = state.NOTE_NAMES.indexOf(state.baseNote);
        const baseMidi = noteIndex + (state.baseOctave + 1) * 12;
        const finalMidi = baseMidi + transpose;
        playAuditionSound(finalMidi);
    });

    // BPM/Rate Modal
    domElements.bpmRateDisplayButton.addEventListener('click', openBpmRateModal);
    domElements.closeBpmRateModalButton.addEventListener('click', closeBpmRateModal);
    domElements.doneBpmRateButton.addEventListener('click', applyBpmRateChanges);
    domElements.bpmRateModal.addEventListener('click', (e) => { 
        if (e.target === domElements.bpmRateModal) {
            closeBpmRateModal();
        } else if (e.target.classList.contains('help-button')) {
            openHelpModal(e.target.dataset.helpTopic);
        }
    });
    domElements.bpmDown10.addEventListener('click', () => adjustBpm(-10));
    domElements.bpmDown1.addEventListener('click', () => adjustBpm(-1));
    domElements.bpmUp1.addEventListener('click', () => adjustBpm(1));
    domElements.bpmUp10.addEventListener('click', () => adjustBpm(10));
    domElements.modalRateButtons.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            state.modalRate = parseFloat(e.target.dataset.rate);
            state.modalRateText = e.target.textContent;
            domElements.modalRateButtons.querySelector('.selected').classList.remove('selected');
            e.target.classList.add('selected');
        }
    });

    // Base Note Modal
    domElements.baseNoteDisplayButton.addEventListener('click', openBaseNoteModal);
    domElements.closeBaseNoteModalButton.addEventListener('click', closeBaseNoteModal);
    domElements.doneBaseNoteButton.addEventListener('click', applyBaseNoteChanges);
    domElements.baseNoteModal.addEventListener('click', (e) => { 
        if (e.target === domElements.baseNoteModal) {
            closeBaseNoteModal(); 
        } else if (e.target.classList.contains('help-button')) {
            openHelpModal(e.target.dataset.helpTopic);
        }
    });
    domElements.modalNoteNameButtons.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            state.modalBaseNote = e.target.dataset.note;
            domElements.modalNoteNameButtons.querySelector('.selected').classList.remove('selected');
            e.target.classList.add('selected');
        }
    });
    domElements.modalOctaveButtons.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            state.modalBaseOctave = parseInt(e.target.dataset.octave, 10);
            domElements.modalOctaveButtons.querySelector('.selected').classList.remove('selected');
            e.target.classList.add('selected');
        }
    });
    domElements.modalWaveformButtons.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            state.modalWaveform = e.target.dataset.wave;
            domElements.modalWaveformButtons.querySelector('.selected').classList.remove('selected');
            e.target.classList.add('selected');
        }
    });

    // Melody Gen Modal
    domElements.closeMelodyGenModalButton.addEventListener('click', closeMelodyGenModal);
    domElements.melodyGenModal.addEventListener('click', (e) => { 
        if (e.target === domElements.melodyGenModal) {
            closeMelodyGenModal(); 
        } else if (e.target.classList.contains('help-button')) {
            openHelpModal(e.target.dataset.helpTopic);
        }
    });
    domElements.previewMelodyButton.addEventListener('click', generateAndPreviewMelody);
    domElements.applyMelodyButton.addEventListener('click', applyMelody);
    domElements.melodyAlgorithmSelect.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            state.melodyGenAlgorithm = e.target.dataset.value;
            domElements.melodyAlgorithmSelect.querySelector('.selected').classList.remove('selected');
            e.target.classList.add('selected');
        }
    });
    domElements.melodyRestProbability.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        state.melodyGenRestProbability = value;
        domElements.melodyRestProbabilityValue.textContent = `${Math.round(value * 100)}%`;
    });

    // Share & Help Modals
    domElements.shareModal.addEventListener('click', (e) => { if (e.target === domElements.shareModal) closeShareModal(); });
    domElements.closeShareModalButton.addEventListener('click', closeShareModal);
    domElements.closeHelpModalButton.addEventListener('click', closeHelpModal);
    domElements.helpModal.addEventListener('click', (e) => { if (e.target === domElements.helpModal) closeHelpModal(); });
    domElements.helpLanguageSwitcher.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            // This logic should be in ui.js
            let currentLang = e.target.dataset.lang;
            // updateHelpContent(currentLang); // This needs refactoring
        }
    });
    domElements.headerContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('help-button')) {
            openHelpModal(e.target.dataset.helpTopic);
        }
    });
    domElements.copyUrlButton.addEventListener('click', () => {
        navigator.clipboard.writeText(domElements.shareUrlInput.value).then(() => {
            domElements.copyUrlButton.textContent = 'コピーしました！';
            setTimeout(() => { domElements.copyUrlButton.textContent = 'URLをコピー'; }, 2000);
        }, () => {
            alert('クリップボードへのコピーに失敗しました。');
        });
    });
    domElements.shareXButton.addEventListener('click', () => {
        const url = domElements.shareUrlInput.value;
        const text = 'このシーケンスをチェック！ #mobiletranspose';
        const xUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
        window.open(xUrl, '_blank');
    });

    // Drag and Drop for Sequencer
    let dragSrcIndex = null;
    domElements.sequencerGrid.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('step')) {
            dragSrcIndex = parseInt(e.target.dataset.index, 10);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', e.target.innerHTML);
            e.target.classList.add('dragging');
        }
    });
    domElements.sequencerGrid.addEventListener('dragover', (e) => {
        e.preventDefault();
        const target = e.target.closest('.step');
        if (target) {
            target.classList.add('drag-over');
        }
        return false;
    });
    domElements.sequencerGrid.addEventListener('dragleave', (e) => {
        const target = e.target.closest('.step');
        if (target) {
            target.classList.remove('drag-over');
        }
    });
    domElements.sequencerGrid.addEventListener('drop', (e) => {
        e.stopPropagation();
        const dropTarget = e.target.closest('.step');
        if (dropTarget) {
            dropTarget.classList.remove('drag-over');
            const dropIndex = parseInt(dropTarget.dataset.index, 10);

            if (dragSrcIndex !== null && dragSrcIndex !== dropIndex) {
                const temp = state.steps[dragSrcIndex];
                state.steps[dragSrcIndex] = state.steps[dropIndex];
                state.steps[dropIndex] = temp;
                // This needs to call a UI update function
                // updateAllStepsUI();
            }
        }
        return false;
    });
    domElements.sequencerGrid.addEventListener('dragend', (e) => {
        e.target.classList.remove('dragging');
        const allSteps = domElements.sequencerGrid.querySelectorAll('.step');
        allSteps.forEach(step => step.classList.remove('drag-over'));
        dragSrcIndex = null;
    });

    // Click listener for steps
    domElements.sequencerGrid.addEventListener('click', (e) => {
        const stepElement = e.target.closest('.step');
        if (stepElement) {
            const index = parseInt(stepElement.dataset.index, 10);
            openStepModal(index);
        }
    });

    // Click listener for seq max buttons
    domElements.seqMaxButtonsContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const newSeqMax = parseInt(e.target.dataset.value, 10);
            const oldSeqMax = state.seqMax;

            const currentActive = domElements.seqMaxButtonsContainer.querySelector('.active');
            if (currentActive) currentActive.classList.remove('active');
            e.target.classList.add('active');

            if (state.isPlaying) {
                if (newSeqMax < oldSeqMax && state.currentStep < newSeqMax) {
                    state.seqMax = newSeqMax;
                    state.pendingSeqMax = null;
                } else {
                    state.pendingSeqMax = newSeqMax;
                }
            } else {
                state.seqMax = newSeqMax;
            }
            // updateDisabledStepsUI();
        }
    });
}
