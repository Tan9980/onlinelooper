const socket = io();
let audioContext;
let mediaRecorder;
let chunks = [];
let loops = [];
let recordingStartTime;
const BEAT_DURATION = 60 / 60; // 1 beat at 60 BPM
const TOTAL_DURATION = 4 * BEAT_DURATION * 1000; // 4 beats in milliseconds

const beatIndicators = document.querySelectorAll('.beat-indicator');
const countdownDisplay = document.getElementById('countdown');

const metronomeSound = document.getElementById('metronome-sound');
const startSound = document.getElementById('start-sound');
const stopSound = document.getElementById('stop-sound');

let beatVisualizationInterval;
let playbackInterval;
let isPlaying = false;
let currentBeat = 0;

// Request microphone access on page load
window.addEventListener('load', () => {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            // Do nothing with the stream, just request access
        })
        .catch(error => {
            console.error('Error accessing microphone on page load:', error);
        });
});

document.getElementById('record').onclick = () => {
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
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            countdownDisplay.innerText = 'Recording...';
            startRecording();
        }
    }, BEAT_DURATION * 1000);
}

function startRecording() {
    startSound.play();
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = e => chunks.push(e.data);
        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { 'type': 'audio/ogg; codecs=opus' });
            chunks = [];
            socket.emit('audio', blob);
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

function stopRecording() {
    stopSound.play();
    if (mediaRecorder) {
        mediaRecorder.stop();
        countdownDisplay.style.visibility = 'hidden';
        document.getElementById('record').innerText = 'Record';
        stopBeatVisualization(); // Stop visualizing beats
    }
}

function createLoop(blob) {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    const loop = { audio, enabled: true };
    loops.push(loop);
    const loopContainer = document.getElementById('loops');
    const loopDiv = document.createElement('div');
    loopDiv.classList.add('loop-container');

    const audioName = document.createElement('div');
    audioName.classList.add('audio-name');
    audioName.innerText = `Track ${loops.length}`;

    const audioControls = document.createElement('div');
    audioControls.classList.add('audio-controls');

    const playPauseButton = document.createElement('button');
    playPauseButton.innerText = 'Play';
    playPauseButton.onclick = () => {
        if (audio.paused) {
            audio.play();
            playPauseButton.innerText = 'Pause';
        } else {
            audio.pause();
            playPauseButton.innerText = 'Play';
        }
    };

    const muteButton = document.createElement('button');
    muteButton.innerText = 'Mute';
    muteButton.onclick = () => {
        audio.muted = !audio.muted;
        muteButton.innerText = audio.muted ? 'Unmute' : 'Mute';
    };

    audioControls.appendChild(playPauseButton);
    audioControls.appendChild(muteButton);

    loopDiv.appendChild(audioName);
    loopDiv.appendChild(audioControls);
    loopContainer.appendChild(loopDiv);
}

function startPlayback() {
    isPlaying = true;
    document.getElementById('play').innerText = 'Pause';
    loops.forEach(loop => {
        if (loop.enabled) {
            loop.audio.currentTime = 0;
            loop.audio.play();
        }
    });
    playbackInterval = setInterval(() => {
        loops.forEach(loop => {
            if (loop.enabled) {
                loop.audio.currentTime = 0;
                loop.audio.play();
            } else {
                loop.audio.pause();
            }
        });
    }, TOTAL_DURATION);
}

function stopPlayback() {
    clearInterval(playbackInterval);
    playbackInterval = null;
    isPlaying = false;
    loops.forEach(loop => loop.audio.pause());
    document.getElementById('play').innerText = 'Play';
}

function startBeatVisualization() {
    if (beatVisualizationInterval) return; // Avoid multiple intervals

    currentBeat = 0;
    function visualizeBeat() {
        beatIndicators.forEach((indicator, index) => {
            indicator.classList.toggle('active', index === currentBeat);
        });
        currentBeat = (currentBeat + 1) % 4;
        if (isPlaying || mediaRecorder?.state === 'recording') {
            beatVisualizationInterval = setTimeout(visualizeBeat, BEAT_DURATION * 1000); // Update every beat
        } else {
            stopBeatVisualization();
        }
    }
    visualizeBeat();
}

function stopBeatVisualization() {
    clearTimeout(beatVisualizationInterval);
    beatVisualizationInterval = null;
    resetBeatIndicators();
}

function resetBeatIndicators() {
    beatIndicators.forEach(indicator => indicator.classList.remove('active'));
}

socket.on('audio', (blob) => {
    createLoop(blob);
});
