const audioCtxOnBtn = document.querySelector("#create-audioctx-btn");
//Oscillators
const gainFaders = document.querySelectorAll(".gain-fader");
const freqFaders = document.querySelectorAll(".freq-fader");
const detuneFader = document.querySelector(".detune-fader");
const transposeFaders = document.querySelectorAll(".transpose-fader");
const oscWaveSelect = document.querySelectorAll(".osc-wave");
//Filter
const filterType = document.querySelector("#filter-type");
const filterC = document.querySelector("#filter-cutoff");
const filterR = document.querySelector("#filter-res");
//Presets
const savePresetBtn = document.querySelector("#save-preset");
const uploadPresetFile = document.querySelector("#preset-file");
//LFO
const lfoMod = document.querySelectorAll('[name="lfo-mod"]');
const lfoWave = document.querySelector("#lfo-wave");
const lfoRate = document.querySelector("#lfo-rate");
const lfoAmt = document.querySelector("#lfo-amt");
const modOsc1 = document.querySelector("#mod-osc1");
const modOsc2 = document.querySelector("#mod-osc2");
const modFilter = document.querySelector("#mod-filter");

const synth = {
    audioCtx: null,
    gainNodes: [null, null, null, null],
    oscillators: [null, null, null],
    filter: null,
    lfo: null,
    lfoGainNode: null,
};

let audioParams = {
    gains: [0, 0, 0, 0],
    ADSR: {
        active: false,
        attack: 0,
        decay: 0,
        sustain: 0,
        release: 0,
    },
    oscFreqs: [200, 200, 200],
    oscWaves: ["sine", "sine", "sine"],
    filter: {
        type: "lowpass",
        cutoff: 500,
        resonance: 0,
    },
    lfo: {
        mod: [null, null, null],
        wave: "sine",
        rate: 0,
        amount: 0,
    },
    oscDetune: 0,
    oscTranspose: [0, 0],
};

/*
 * Create audio context and update audio params
 */
function createAudioCtx() {
    if (!synth.audioCtx || synth.audioCtx.state === "closed") {
        //Create AudioContext & oscillators
        synth.audioCtx = new (window.AudioContext ||
            window.webkitAudioContext)();

        //Create gain nodes
        for (let i = 0; i < synth.gainNodes.length; i++) {
            synth.gainNodes[i] = synth.audioCtx.createGain();
            synth.gainNodes[i].gain.setValueAtTime(
                audioParams.gains[i],
                synth.audioCtx.currentTime
            );
        }

        //Create LFO gain node
        synth.lfoGainNode = synth.audioCtx.createGain();

        //Create & connect filter
        synth.filter = synth.audioCtx.createBiquadFilter();
        synth.filter.connect(synth.gainNodes[0]);

        //Create & connect oscillators
        for (let i = 0; i < synth.oscillators.length; i++) {
            synth.oscillators[i] = synth.audioCtx.createOscillator();
            synth.oscillators[i].connect(synth.gainNodes[i + 1]);
        }

        //Create & connect LFO
        synth.lfo = synth.audioCtx.createOscillator();
        synth.lfo.connect(synth.lfoGainNode);

        //Connect gain nodes
        for (let i = 0; i < synth.gainNodes.length; i++) {
            if (i === 0) {
                //gainNode[0] is master
                synth.gainNodes[i].connect(synth.audioCtx.destination);
            } else {
                synth.gainNodes[i].connect(synth.filter);
            }
        }

        //update params
        updateParams();

        //Start oscillators
        for (let i = 0; i < synth.oscillators.length; i++) {
            synth.oscillators[i].start(synth.audioCtx.currentTime);
        }

        //Start LFO
        synth.lfo.start(synth.audioCtx.currentTime);

        document.querySelectorAll(":disabled").forEach((e) => {
            e.disabled = false;
        });

        audioCtxOnBtn.classList.add("on");
    } else {
        synth.audioCtx.close();
        audioCtxOnBtn.classList.remove("on");
    }
}

/*
 * Update audio params
 */
function updateParams() {
    //Master & oscillators gain
    gainFaders.forEach((e, index) => {
        let gain = parseFloat(e.value);
        audioParams.gains[index] = gain.toFixed(2);
        e.nextElementSibling.innerText = gain.toFixed(2);

        if (synth.audioCtx && audioParams.ADSR.active === false) {
            synth.gainNodes[index].gain.linearRampToValueAtTime(
                gain,
                synth.audioCtx.currentTime + 0.1
            );
        }
    });

    //Envelope
    updateEG();

    //Oscillators waves
    oscWaveSelect.forEach((e, index) => {
        let wave = e.value;
        audioParams.oscWaves[index] = wave;

        if (synth.audioCtx) {
            synth.oscillators[index].type = wave;
        }
    });

    //Oscillators frequencies
    freqFaders.forEach((e, index) => {
        let freq = e.value;
        audioParams.oscFreqs[index] = freq;
        e.nextElementSibling.innerText = freq + " Hz";

        if (synth.audioCtx) {
            synth.oscillators[index].frequency.value = freq;
        }
    });

    //OSC III Detune
    let osc3Detune = detuneFader.value;
    audioParams.oscDetune = osc3Detune;
    detuneFader.nextElementSibling.innerText = osc3Detune + " cents";
    if (synth.audioCtx) {
        synth.oscillators[2].detune.value = osc3Detune;
    }

    //Oscillators I & II Transpose
    transposeFaders.forEach((e, index) => {
        let semitones = parseInt(e.value) * 100;
        audioParams.oscTranspose[index] = parseInt(e.value);

        let intervals = {
            "-1200": "-8th",
            "-1100": "-M7th",
            "-1000": "-m7th",
            "-900": "-M6th",
            "-800": "-m6th",
            "-700": "-5th",
            "-600": "-aug4th",
            "-500": "-4th",
            "-400": "-M3rd",
            "-300": "-m3rd",
            "-200": "-M2nd",
            "-100": "-m2nd",
            0: "0",
            1200: "8th",
            1100: "M7th",
            1000: "m7th",
            900: "M6th",
            800: "m6th",
            700: "5th",
            600: "aug4th",
            500: "4th",
            400: "M3rd",
            300: "m3rd",
            200: "M2nd",
            100: "m2nd",
        };

        e.nextElementSibling.innerText = intervals[semitones];

        if (synth.audioCtx) {
            synth.oscillators[index].detune.value = semitones;
        }
    });

    //Filter
    let cut = filterC.value;
    let res = filterR.value;
    audioParams.filter.type = filterType.value;
    audioParams.filter.cutoff = cut;
    audioParams.filter.resonance = res;

    if (synth.audioCtx) {
        synth.filter.type = filterType.value;
        synth.filter.frequency.exponentialRampToValueAtTime(
            cut,
            synth.audioCtx.currentTime + 0.2
        );
        synth.filter.Q.value = res;
    }

    filterC.nextElementSibling.innerText = cut + " Hz";
    filterR.nextElementSibling.innerText = res;

    //LFO
    let LFOWave = lfoWave.value;
    let LFORate = lfoRate.value;
    let LFOAmt = lfoAmt.value;

    //For saving LFO preset
    lfoMod.forEach((e, index) => {
        if (e.checked) {
            audioParams.lfo.mod[index] = e.value;
        } else {
            audioParams.lfo.mod[index] = null;
        }
    });

    //Connect LFO when loading user preset
    if (synth.audioCtx) {
        if (audioParams.lfo.mod[0]) {
            synth.lfoGainNode.connect(synth.filter.frequency);
        }

        if (audioParams.lfo.mod[1]) {
            synth.lfoGainNode.connect(synth.oscillators[0].frequency);
        }

        if (audioParams.lfo.mod[2]) {
            synth.lfoGainNode.connect(synth.oscillators[1].frequency);
        }
    }

    audioParams.lfo.wave = LFOWave;
    audioParams.lfo.rate = LFORate;
    audioParams.lfo.amount = LFOAmt;

    if (synth.audioCtx) {
        synth.lfo.type = LFOWave;
        synth.lfo.frequency.value = LFORate;
        lfoRate.nextElementSibling.innerText = LFORate;
        synth.lfoGainNode.gain.value = LFOAmt;
        lfoAmt.nextElementSibling.innerText = LFOAmt;
    }
}

//Update LFO mod
//mod filter cut
modFilter.addEventListener("change", function () {
    if (synth.audioCtx) {
        if (this.checked) {
            synth.lfoGainNode.connect(synth.filter.frequency);
        } else {
            synth.lfoGainNode.disconnect(synth.filter.frequency);
        }
    }
});

//mod osc I pitch
modOsc1.addEventListener("change", function () {
    if (synth.audioCtx) {
        if (this.checked) {
            synth.lfoGainNode.connect(synth.oscillators[0].frequency);
        } else {
            synth.lfoGainNode.disconnect(synth.oscillators[0].frequency);
        }
    }
});

//mod osc II pitch
modOsc2.addEventListener("change", function () {
    if (synth.audioCtx) {
        if (this.checked) {
            synth.lfoGainNode.connect(synth.oscillators[1].frequency);
        } else {
            synth.lfoGainNode.disconnect(synth.oscillators[1].frequency);
        }
    }
});

//Create audio context
audioCtxOnBtn.addEventListener("click", createAudioCtx);
//Update params
document.querySelector("#master-gain").addEventListener("input", updateParams);
document.querySelector("#filter").addEventListener("input", updateParams);
document.querySelector("#lfo").addEventListener("input", updateParams);
document.querySelector("#oscillators").addEventListener("input", updateParams);

/*
 * Presets
 */

//Upload user preset
function uploadPreset(e) {
    let reader = new FileReader();

    reader.addEventListener("load", (e) => {
        document.querySelector("#preset").innerHTML = e.target.result;

        let preset = JSON.parse(e.target.result);
        audioParams = preset;

        setParams();
        updateParams();
    });
    reader.readAsText(e.target.files[0]);
}

//Set params as user preset
function setParams() {
    gainFaders.forEach((e, i) => {
        e.value = audioParams.gains[i];
    });

    EG.classList = audioParams.ADSR.active === true ? "" : "disabled";

    if (audioParams.ADSR.active === true) {
        EG.classList.remove("disabled");
        activateEG.classList.add("on");
        activateEG.innerText = "Desactivar Envolvente";
    } else {
        EG.classList.add("disabled");
        activateEG.classList.remove("on");
        activateEG.innerText = "Activar envolvente";
    }

    A.value = audioParams.ADSR.attack;
    A.nextElementSibling.innerText = A.value;
    D.value = audioParams.ADSR.decay;
    D.nextElementSibling.innerText = D.value;
    S.value = audioParams.ADSR.sustain;
    S.nextElementSibling.innerText = S.value;
    R.value = audioParams.ADSR.release;
    R.nextElementSibling.innerText = R.value;

    freqFaders.forEach((e, i) => {
        e.value = audioParams.oscFreqs[i];
    });

    detuneFader.value = audioParams.oscDetune;

    transposeFaders.forEach((e, i) => {
        e.value = audioParams.oscTranspose[i];
    });

    oscWaveSelect.forEach((e, i) => {
        e.value = audioParams.oscWaves[i];
    });

    filterType.value = audioParams.filter.type;
    filterC.value = audioParams.filter.cutoff;
    filterC.nextElementSibling.innerText = filterC.value + " Hz";
    filterR.value = audioParams.filter.resonance;
    filterR.nextElementSibling.innerText = filterR.value;

    lfoWave.value = audioParams.lfo.wave;
    lfoRate.value = audioParams.lfo.rate;
    lfoAmt.value = audioParams.lfo.amount;

    modFilter.checked = audioParams.lfo.mod[0] !== null ? true : false;
    modOsc1.checked = audioParams.lfo.mod[1] !== null ? true : false;
    modOsc2.checked = audioParams.lfo.mod[2] !== null ? true : false;
}

//Show params - download user preset
savePresetBtn.addEventListener("click", function () {
    document.querySelector("#audio-params").innerHTML =
        JSON.stringify(audioParams);

    const userPreset =
        "data:text/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(audioParams));

    const downloadLink = document.querySelector("#download-preset");

    downloadLink.classList.remove("hidden");

    downloadLink.addEventListener("click", () => {
        const presetName = document.querySelector("#preset-name").value;
        downloadLink.setAttribute("href", userPreset);
        downloadLink.setAttribute("download", presetName + ".json");
    });

    savePresetBtn.innerText = "Save new preset";
});

//Upload user preset
uploadPresetFile.addEventListener("change", uploadPreset);
