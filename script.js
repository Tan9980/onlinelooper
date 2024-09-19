const socket = io();
let audioContext = new (window.AudioContext || window.webkitAudioContext)();
let mediaRecorder;
let chunks = [];
let loops = [];
let currentLoopSet = 0;
let loopSets = [[]]; // Array of loop sets, each being an array of loops
let recordingStartTime;
let bpm = 80; // Default BPM
let BEAT_DURATION = 60 / bpm;
let TOTAL_DURATION = 4 * BEAT_DURATION * 1000;

const beatIndicators = document.querySelectorAll('.beat-indicator');
const countdownDisplay = document.getElementById('countdown');
const bpmInput = document.getElementById('bpm');

const metronomeSound = document.getElementById('metronome-sound');
const startSound = document.getElementById('start-sound');
const stopSound = document.getElementById('stop-sound');

let beatVisualizationInterval;
let playbackInterval;
let isPlaying = false;
let currentBeat = 0;
let isMicrophoneAccessible = false; // Flag to check microphone access

// Request microphone access on page load
window.addEventListener('load', () => {
    checkMicrophonePermission();
});

// Function to check and request microphone permission
function checkMicrophonePermission() {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            isMicrophoneAccessible = true;
            // Create a silent dummy recording to initialize mediaRecorder
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = e => chunks.push(e.data);
            mediaRecorder.onstop = () => {
                // Do nothing for the dummy recording
            };
            mediaRecorder.start();
            setTimeout(() => mediaRecorder.stop(), 100); // Stop after a short delay
        })
        .catch(error => {
            console.error('Error accessing microphone:', error);
            alert('Microphone access is required to use the recording feature.');
        });
}

// Event listener to update BPM
bpmInput.addEventListener('change', (event) => {
    bpm = parseInt(event.target.value, 10);
    BEAT_DURATION = 60 / bpm;
    TOTAL_DURATION = 4 * BEAT_DURATION * 1000;
    if (isPlaying) {
        stopPlayback();
        startPlayback();
    }
});

// Event listeners for buttons
document.getElementById('record').onclick = () => {
    if (!isMicrophoneAccessible) {
        alert('Microphone access is required to use the recording feature.');
        return;
    }
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        startBuffer();
    } else if (mediaRecorder.state === 'recording') {
        stopRecording();
    }
};

document.getElementById('play').onclick = () => {
    if (!isPlaying) {
        startPlayback();
        startBeatVisualization();
    } else {
        stopPlayback();
        stopBeatVisualization();
    }
};

document.getElementById('new-set').onclick = () => {
    loopSets.push([]);
    currentLoopSet = loopSets.length - 1;
    updateSetName();
    renderLoopSet();
};

document.getElementById('previous-set').onclick = () => {
    if (currentLoopSet > 0) {
        currentLoopSet--;
        updateSetName();
        renderLoopSet();
    }
};

document.getElementById('next-set').onclick = () => {
    if (currentLoopSet < loopSets.length - 1) {
        currentLoopSet++;
        updateSetName();
        renderLoopSet();
    }
};

document.getElementById('move-set-up').onclick = () => {
    if (currentLoopSet > 0) {
        [loopSets[currentLoopSet], loopSets[currentLoopSet - 1]] = [loopSets[currentLoopSet - 1], loopSets[currentLoopSet]];
        currentLoopSet--;
        updateSetName();
        renderLoopSet();
    }
};

document.getElementById('move-set-down').onclick = () => {
    if (currentLoopSet < loopSets.length - 1) {
        [loopSets[currentLoopSet], loopSets[currentLoopSet + 1]] = [loopSets[currentLoopSet + 1], loopSets[currentLoopSet]];
        currentLoopSet++;
        updateSetName();
        renderLoopSet();
    }
};

// Start a buffer countdown before recording
function startBuffer() {
    let countdown = 4;
    countdownDisplay.style.visibility = 'visible';
    countdownDisplay.innerText = countdown;
    metronomeSound.play();
    const countdownInterval = setInterval(() => {
        countdown -= 1;
        countdownDisplay.innerText = countdown;
        metronomeSound.currentTime = 0;
        metronomeSound.play();
        resetBeatIndicators(); // Clear previous states
        beatIndicators.forEach((indicator, index) => {
            indicator.classList.toggle('countdown', index === 4 - countdown);
        });
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            countdownDisplay.innerText = 'Recording...';
            startRecording();
            resetBeatIndicators(); // Clear indicators before recording
        }
    }, BEAT_DURATION * 1000);
}

// Start recording
function startRecording() {
    startSound.play();
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = e => chunks.push(e.data);
        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { 'type': 'audio/ogg; codecs=opus' });
            chunks = [];
            createLoop(blob);
        };
        mediaRecorder.start();
        recordingStartTime = audioContext.currentTime;
        document.getElementById('record').innerText = 'Stop Recording';
        setTimeout(stopRecording, TOTAL_DURATION); // Stop after total duration
        startBeatVisualization(); // Start visualizing beats during recording
    }).catch(error => {
        console.error('Error accessing microphone:', error);
    });
}

// Stop recording
function stopRecording() {
    stopSound.play();
    if (mediaRecorder) {
        mediaRecorder.stop();
        countdownDisplay.style.visibility = 'hidden';
        document.getElementById('record').innerText = 'Record';
        stopBeatVisualization(); // Stop visualizing beats
    }
}

// Create a new loop from the recorded audio blob
function createLoop(blob) {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    const loop = { audio, enabled: true };
    loopSets[currentLoopSet].push(loop);
    renderLoopSet();
}

// Render the current loop set
function renderLoopSet() {
    const loopContainer = document.getElementById('loops');
    loopContainer.innerHTML = ''; // Clear existing loops
    loopSets[currentLoopSet].forEach((loop, index) => {
        const loopDiv = document.createElement('div');
        loopDiv.classList.add('loop-container');
        const audioName = document.createElement('div');
        audioName.classList.add('audio-name');
        audioName.innerText = `Track ${index + 1}`;
        const audioControls = document.createElement('div');
        audioControls.classList.add('audio-controls');
        const playPauseButton = document.createElement('button');
        playPauseButton.innerText = 'Play';
        playPauseButton.onclick = () => {
            if (loop.audio.paused) {
                loop.audio.play();
                playPauseButton.innerText = 'Pause';
            } else {
                loop.audio.pause();
                playPauseButton.innerText = 'Play';
            }
        };
        const muteButton = document.createElement('button');
        muteButton.innerText = 'Mute';
        muteButton.onclick = () => {
            loop.audio.muted = !loop.audio.muted;
            muteButton.innerText = loop.audio.muted ? 'Unmute' : 'Mute';
        };
        audioControls.appendChild(playPauseButton);
        audioControls.appendChild(muteButton);
        loopDiv.appendChild(audioName);
        loopDiv.appendChild(audioControls);
        loopContainer.appendChild(loopDiv);
    });
}

// Start playback of the current loop set
function startPlayback() {
    isPlaying = true;
    document.getElementById('play').innerText = 'Pause';
    loopSets[currentLoopSet].forEach(loop => {
        if (loop.enabled) {
            loop.audio.currentTime = 0;
            loop.audio.play();
        }
    });
    playbackInterval = setInterval(() => {
        loopSets[currentLoopSet].forEach(loop => {
            if (loop.enabled) {
                loop.audio.currentTime = 0;
                loop.audio.play();
            } else {
                loop.audio.pause();
            }
        });
    }, TOTAL_DURATION);
}

// Stop playback
function stopPlayback() {
    clearInterval(playbackInterval);
    playbackInterval = null;
    isPlaying = false;
    loopSets[currentLoopSet].forEach(loop => loop.audio.pause());
    document.getElementById('play').innerText = 'Play';
}

// Start beat visualization
function startBeatVisualization() {
    if (beatVisualizationInterval) return; // Avoid multiple intervals
    currentBeat = 0;
    
    function visualizeBeat() {
        beatIndicators.forEach((indicator, index) => {
            if (isPlaying || mediaRecorder?.state === 'recording') {
                if (mediaRecorder?.state === 'recording') {
                    indicator.classList.toggle('filled', index === currentBeat);
                } else {
                    indicator.classList.toggle('active', index === currentBeat);
                }
            } else {
                indicator.classList.remove('active', 'filled', 'countdown');
            }
        });

        currentBeat = (currentBeat + 1) % beatIndicators.length;
    }

    beatVisualizationInterval = setInterval(visualizeBeat, BEAT_DURATION * 1000);
}

// Stop beat visualization
function stopBeatVisualization() {
    clearInterval(beatVisualizationInterval);
    beatVisualizationInterval = null;
    beatIndicators.forEach(indicator => {
        indicator.classList.remove('active', 'filled', 'countdown');
    });
}

// Update the set name display
function updateSetName() {
    document.getElementById('set-name').innerText = `Set ${currentLoopSet + 1}`;
}

// Reset beat indicators
function resetBeatIndicators() {
    beatIndicators.forEach(indicator => {
        indicator.classList.remove('active', 'filled', 'countdown');
    });
}

// Call this function to initialize the page with the first loop set
function init() {
    updateSetName();
    renderLoopSet();
}

init();
