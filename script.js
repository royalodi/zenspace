// Audio Synthesis context for ambient sounds & breathing ticks
let zenAudioCtx = null;
let ambientOscillators = [];
let ambientModulator = null;

// Mock database for positive daily quotes
const quoteDb = [
    { text: "Quiet the mind and the soul will speak.", author: "Buddha" },
    { text: "The present moment is filled with joy and happiness. If you are attentive, you will see it.", author: "Thich Nhat Hanh" },
    { text: "Within you, there is a stillness and a sanctuary to which you can retreat at any time.", author: "Hermann Hesse" },
    { text: "Feelings come and go like clouds in a windy sky. Conscious breathing is my anchor.", author: "Thich Nhat Hanh" },
    { text: "Rule your mind or it will rule you.", author: "Horace" },
    { text: "Quiet minds cannot be perplexed or frightened.", author: "Thomas Kempis" }
];

// App State
let breathActive = false;
let breathInterval = null;
let breathSubPhase = 0; // 0: Inhale, 1: Hold, 2: Exhale

let meditationInterval = null;
let meditationTimeRemaining = 300; // default 5m
let meditationState = 'idle'; // idle, running

let moodLogs = [];

// DOM References
const dailyQuoteText = document.getElementById('dailyQuoteText');
const dailyQuoteAuthor = document.getElementById('dailyQuoteAuthor');

const btnToggleBreath = document.getElementById('btnToggleBreath');
const breathSphere = document.getElementById('breathSphere');
const breathInstruction = document.getElementById('breathInstruction');

const btnStartMeditation = document.getElementById('btnStartMeditation');
const btnCancelMeditation = document.getElementById('btnCancelMeditation');
const meditationSettings = document.getElementById('meditationSettings');
const meditationActiveClock = document.getElementById('meditationActiveClock');
const meditationClockText = document.getElementById('meditationClockText');
const meditationStatusText = document.getElementById('meditationStatusText');
const meditationDuration = document.getElementById('meditationDuration');
const ambientSoundType = document.getElementById('ambientSoundType');

const moodLogsList = document.getElementById('moodLogsList');

// Init
document.addEventListener("DOMContentLoaded", () => {
    loadQuotes();
    loadMoods();
    setupEventHandlers();
});

function setupEventHandlers() {
    btnToggleBreath.addEventListener('click', toggleBreathingCycle);
    btnStartMeditation.addEventListener('click', toggleMeditationSession);
    btnCancelMeditation.addEventListener('click', stopMeditationSession);
    
    const btnClearLogs = document.getElementById('btnClearLogs');
    let clearLogsArmed = false;
    btnClearLogs.addEventListener('click', () => {
        if (!clearLogsArmed) {
            clearLogsArmed = true;
            btnClearLogs.dataset.orig = btnClearLogs.innerHTML;
            btnClearLogs.innerHTML = 'Confirm?';
            setTimeout(() => {
                clearLogsArmed = false;
                if (btnClearLogs.dataset.orig) btnClearLogs.innerHTML = btnClearLogs.dataset.orig;
            }, 3000);
            return;
        }
        clearLogsArmed = false;
        if (btnClearLogs.dataset.orig) btnClearLogs.innerHTML = btnClearLogs.dataset.orig;
        moodLogs = [];
        localStorage.removeItem('zen_moods');
        renderMoodLogs();
    });
}

// Load quotes
function loadQuotes() {
    const idx = Math.floor(Math.random() * quoteDb.length);
    dailyQuoteText.innerText = `"${quoteDb[idx].text}"`;
    dailyQuoteAuthor.innerText = `— ${quoteDb[idx].author}`;
}

// Load moods
function loadMoods() {
    try {
        const saved = localStorage.getItem('zen_moods');
        if (saved) {
            moodLogs = JSON.parse(saved);
        }
    } catch (e) {
        moodLogs = [];
    }
    renderMoodLogs();
}

// Audio Synthesis Engines (Tibetan Ocean Swells & Cosmic Nebula Drones)
function startAmbientSynth(type) {
    try {
        if (!zenAudioCtx) {
            zenAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (zenAudioCtx.state === 'suspended') {
            zenAudioCtx.resume();
        }

        stopAmbientSynth(); // Ensure any running oscillators are cleared

        if (type === 'none') return;

        if (type === 'ocean') {
            // Generate low frequency carrier (80Hz) modulated by a slow wave LFO (0.15Hz)
            const carrier = zenAudioCtx.createOscillator();
            const modulator = zenAudioCtx.createOscillator();
            const modulatorGain = zenAudioCtx.createGain();
            const mainGain = zenAudioCtx.createGain();

            carrier.frequency.value = 80; // deep drone
            modulator.frequency.value = 0.15; // slow tide swell frequency
            modulatorGain.gain.value = 25; // depth of swell

            modulator.connect(modulatorGain);
            modulatorGain.connect(carrier.frequency); // frequency modulation

            mainGain.gain.setValueAtTime(0.08, zenAudioCtx.currentTime); // keep volume soothing and low

            carrier.connect(mainGain);
            mainGain.connect(zenAudioCtx.destination);

            carrier.start();
            modulator.start();

            ambientOscillators = [carrier, modulator];
        } 
        else if (type === 'cosmic') {
            // Harmonics synthesis combining multiple minor frequencies (55Hz, 110Hz, 165Hz) with band filters
            const frequencies = [55, 110, 165];
            const filter = zenAudioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 250;

            const mainGain = zenAudioCtx.createGain();
            mainGain.gain.setValueAtTime(0.06, zenAudioCtx.currentTime);

            filter.connect(mainGain);
            mainGain.connect(zenAudioCtx.destination);

            frequencies.forEach(f => {
                const osc = zenAudioCtx.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.value = f;
                
                // Add slow individual vibrato to each note
                const vib = zenAudioCtx.createOscillator();
                const vibGain = zenAudioCtx.createGain();
                vib.frequency.value = Math.random() * 2 + 0.5;
                vibGain.gain.value = 1.5;

                vib.connect(vibGain);
                vibGain.connect(osc.frequency);

                osc.connect(filter);

                osc.start();
                vib.start();

                ambientOscillators.push(osc);
                ambientOscillators.push(vib);
            });
        }
    } catch (e) {
        console.log("Audio Context synthesis is blocked or unsupported:", e);
    }
}

function stopAmbientSynth() {
    ambientOscillators.forEach(osc => {
        try { osc.stop(); } catch(e){}
    });
    ambientOscillators = [];
}

// Single high bowl bell synthesized tone on session complete
function playBellBeep() {
    try {
        if (!zenAudioCtx) {
            zenAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        const osc = zenAudioCtx.createOscillator();
        const gainNode = zenAudioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(zenAudioCtx.destination);

        osc.frequency.setValueAtTime(659.25, zenAudioCtx.currentTime); // E5 soothing note
        gainNode.gain.setValueAtTime(0.12, zenAudioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, zenAudioCtx.currentTime + 1.8);

        osc.start();
        osc.stop(zenAudioCtx.currentTime + 1.8);
    } catch(e){}
}

// Guided breathing cycle logic
function toggleBreathingCycle() {
    if (!breathActive) {
        breathActive = true;
        btnToggleBreath.innerHTML = '<i class="fa-solid fa-stop me-2"></i>Stop Breathing Guide';
        btnToggleBreath.className = 'btn btn-outline-danger-zen w-100';
        
        // Setup initial sound context
        if (!zenAudioCtx) {
            zenAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        breathSubPhase = 0; // Inhale
        runBreathPacer();
    } else {
        stopBreathingCycle();
    }
}

function stopBreathingCycle() {
    breathActive = false;
    clearInterval(breathInterval);
    
    // Clear sphere classes
    breathSphere.className = 'breath-sphere';
    breathInstruction.innerText = 'TAP START BELOW';
    
    btnToggleBreath.innerHTML = '<i class="fa-solid fa-play me-2"></i>Begin Breathing Cycle';
    btnToggleBreath.className = 'btn btn-primary-zen w-100';
}

function runBreathPacer() {
    clearInterval(breathInterval);
    executeBreathStep();
    
    breathInterval = setInterval(() => {
        breathSubPhase = (breathSubPhase + 1) % 3;
        executeBreathStep();
    }, 4000); // 4 seconds per phase
}

function executeBreathStep() {
    breathSphere.className = 'breath-sphere';

    if (breathSubPhase === 0) {
        // Inhale (4s)
        breathSphere.classList.add('inhale');
        breathInstruction.innerText = 'Breathe In...';
        
        // Synth soft pitch sweep
        triggerPitchSweep(300, 500, 3.5);
    } 
    else if (breathSubPhase === 1) {
        // Hold (4s)
        breathSphere.classList.add('hold');
        breathInstruction.innerText = 'Hold...';
        
        // Synth subtle static sound
        triggerPitchSweep(500, 500, 3.5);
    } 
    else if (breathSubPhase === 2) {
        // Exhale (4s)
        breathSphere.classList.add('exhale');
        breathInstruction.innerText = 'Exhale...';
        
        // Synth downward pitch sweep
        triggerPitchSweep(500, 300, 3.5);
    }
}

function triggerPitchSweep(startFreq, endFreq, duration) {
    try {
        if (!zenAudioCtx) return;
        const osc = zenAudioCtx.createOscillator();
        const gainNode = zenAudioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(zenAudioCtx.destination);

        osc.frequency.setValueAtTime(startFreq, zenAudioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(endFreq, zenAudioCtx.currentTime + duration);

        gainNode.gain.setValueAtTime(0.03, zenAudioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, zenAudioCtx.currentTime + duration);

        osc.start();
        osc.stop(zenAudioCtx.currentTime + duration);
    } catch(e){}
}

// Meditation Session Logic
function toggleMeditationSession() {
    if (meditationState === 'idle') {
        const dur = parseInt(meditationDuration.value);
        const soundType = ambientSoundType.value;

        meditationTimeRemaining = dur;
        meditationState = 'running';

        meditationSettings.classList.add('d-none');
        meditationActiveClock.classList.remove('d-none');
        
        btnStartMeditation.classList.add('d-none');
        document.getElementById('meditationActiveControls').classList.remove('d-none');

        // Start synthesized ambient audio waves
        startAmbientSynth(soundType);

        runMeditationCountdown();
    }
}

function runMeditationCountdown() {
    clearInterval(meditationInterval);
    updateMeditationUI();

    meditationInterval = setInterval(() => {
        meditationTimeRemaining--;

        if (meditationTimeRemaining <= 0) {
            completeMeditationSession();
        } else {
            updateMeditationUI();
        }
    }, 1000);
}

function updateMeditationUI() {
    const mins = Math.floor(meditationTimeRemaining / 60).toString().padStart(2, '0');
    const secs = (meditationTimeRemaining % 60).toString().padStart(2, '0');
    meditationClockText.innerText = `${mins}:${secs}`;
}

function stopMeditationSession() {
    clearInterval(meditationInterval);
    stopAmbientSynth();
    meditationState = 'idle';

    meditationSettings.classList.remove('d-none');
    meditationActiveClock.classList.add('d-none');
    
    btnStartMeditation.classList.remove('d-none');
    document.getElementById('meditationActiveControls').classList.add('d-none');
}

function completeMeditationSession() {
    clearInterval(meditationInterval);
    stopAmbientSynth();
    meditationState = 'idle';

    meditationClockText.innerText = 'PEACE';
    meditationStatusText.innerText = 'SESSION COMPLETED';
    
    playBellBeep(); // Ring Tibetan bowl bell

    // Add meditation log to history
    logMood('Meditated', '🧘');

    setTimeout(() => {
        stopMeditationSession();
    }, 3000);
}

// Mood logs handlers
function logMood(moodName, emoji) {
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const entry = {
        name: moodName,
        emoji: emoji,
        date: dateStr
    };

    moodLogs.unshift(entry);
    if (moodLogs.length > 20) moodLogs.pop(); // Cap history to 20 entries

    localStorage.setItem('zen_moods', JSON.stringify(moodLogs));
    renderMoodLogs();
    
    if (typeof playBellBeep === 'function') triggerPitchSweep(600, 750, 0.12);
}

function renderMoodLogs() {
    moodLogsList.innerHTML = '';
    
    if(moodLogs.length === 0) {
        moodLogsList.innerHTML = `
            <div class="text-center py-4">
                <i class="fa-solid fa-spa fs-3 text-muted-zen mb-2"></i>
                <p class="text-muted-zen small">No mood entries logged today.</p>
            </div>
        `;
        return;
    }

    moodLogs.forEach(log => {
        const row = document.createElement('div');
        row.className = 'mood-log-item';
        row.innerHTML = `
            <div class="mood-log-label">
                <span>${log.emoji}</span>
                <span class="fw-semibold text-white">${log.name}</span>
            </div>
            <span class="mood-log-date">${log.date}</span>
        `;
        moodLogsList.appendChild(row);
    });
}
