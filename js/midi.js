/*
 *   MIDI & Envelope config (playing notes)
 */

const midiInfo = document.querySelector("#midi-info");
const activateEG = document.querySelector("#activate-eg-btn");

/*
 *   MIDI (Web MIDI API)
 */
if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess().then(onMIDIsuccess, onMIDIfailure);
}

function onMIDIsuccess(midi) {

    if (midi.inputs.size !== 0) {
        //enable envelope 
        activateEG.disabled = false;
        //check for user's midi config
        let midiConfig = getMidiConfig();

        if(!midiConfig) {
            midiInfo.innerText = "Device connected!- Map your controller";
        } else {
            midiInfo.innerText = "Device connected!- Edit or clear your MIDI mapping";
        }
    } else {
        midiInfo.innerText =
            "No device connected, connect your device and reload page.";
        activateEG.disabled = true;
            
    }

    let inputs = midi.inputs.values();

    for (
        let input = inputs.next();
        input && !input.done;
        input = inputs.next()
    ) {
        input.value.onmidimessage = onMIDIMessage;
    }
}

function onMIDIfailure() {
    console.error("No access to your midi devices.");
}

/*
 * MIDI config
*/

/* Midi map form */
const midiMapConfig = document.querySelector("#midiMapConfig");
const midiDestination = document.querySelector("#midiDestination");
const midiCC = document.querySelector("#midiCC");
const midiMapMessage = document.querySelector("#midiMapMessage");



/* On success onMIDIMessage*/
function onMIDIMessage(message) {
    let frequency = midiNoteToFrequency(message.data[1]).toFixed(2);

    /* MIDI notes */
    if (synth.audioCtx) {
        /* 144 midi message for noteOn */
        if (message.data[0] === 144 && message.data[2] > 0) {
            playNote(frequency);
        }

        /* 128 midi message fot noteOff */
        if (
            message.data[0] === 128 &&
            message.data[2] === 0 &&
            audioParams.ADSR.active === true
        ) {
            noteOff(frequency);
        }
    }

    //MIDI CC config
    //to set midi mapping
    midiCC.value = message.data[1];

    //get user's midi config
    let midiConfig = getMidiConfig();

    if(midiConfig !== null) {

        //midi to filter cut
        if(midiConfig['Filter Cut'] && message.data[1] == midiConfig['Filter Cut']) {
            let midiInput = midiCCMap(message.data[2], 100, 12000);
            midiToFilterC(midiInput);
        } 

        //midi to filter res
        if(midiConfig['Filter Res'] && message.data[1] == midiConfig['Filter Res']) {
            let midiInput = midiCCMap(message.data[2], 0, 30);
            midiToFilterR(midiInput);
        } 

        //midi to LFO RATE
        if(midiConfig['LFO Rate'] && message.data[1] == midiConfig['LFO Rate']) {
            let midiInput = midiCCMap(message.data[2], 0.1, 15);
            midiToLFORate(midiInput);
        }

        //midi to LFO AMT
        if(midiConfig['LFO Amount'] && message.data[1] == midiConfig['LFO Amount']) {
            let midiInput = midiCCMap(message.data[2], 0.5, 1000);
            midiToLFOAmt(midiInput);
        }

        //midi to master gain && oscilaltors gain
        if( (midiConfig['Master Gain'] ||
            midiConfig['OSC I Gain'] ||
            midiConfig['OSC II Gain'] ||
            midiConfig['OSC III Gain']) && 
            (message.data[1] == midiConfig['Master Gain'] ||
            message.data[1] == midiConfig['OSC I Gain'] ||
            message.data[1] == midiConfig['OSC II Gain'] ||
            message.data[1] == midiConfig['OSC III Gain'])
            ) {

            let gainInput = midiCCMap(message.data[2], 0, 0.5);

            let gainNodes = {
                'Master Gain': 0,
                'OSC I Gain': 1,
                'OSC II Gain': 2,
                'OSC III Gain': 3
            }

            let node = Object.keys(midiConfig).find(key => midiConfig[key] == message.data[1]);

            midiToGains(gainNodes[node], gainInput);
        }


        //MIDI to oscillators frequencies
        if((midiConfig['OSC I Freq'] ||
        midiConfig['OSC II Freq'] ||
        midiConfig['OSC III Freq']) && 
        (message.data[1] == midiConfig['OSC I Freq'] ||
        message.data[1] == midiConfig['OSC II Freq'] ||
        message.data[1] == midiConfig['OSC III Freq'])
        ) {
            let freq = midiCCMap(message.data[2], 40, 1000);

            let oscillators = {
                'OSC I Freq': 0,
                'OSC II Freq': 1,
                'OSC III Freq': 2,
            };

            let oscN = Object.keys(midiConfig).find(key => midiConfig[key] == message.data[1]);

            midiCCtoOSCFreq(oscillators[oscN], freq);
        }
    }
   
}

/* MIDI Mapping */
midiMapConfig.addEventListener("submit", midiConfig );

function midiConfig(e) {
    e.preventDefault();

    if(!midiDestination || !midiCC.value) {
        midiMapMessage.innerText = "Please, enter a Midi Destination and Midi CC values."
    } else {
        midiConfigSave(midiDestination.value, midiCC.value);
    }
}

/* Set local storage of midi config */
const localStorage = window.localStorage;

const midiWarning = document.querySelector("#midiWarning");
const clearCC = document.querySelector("#clearCC"); 

/* Save MIDI Config */
function midiConfigSave(param, value) {

    const paramConfig = {
        [param]: value
    }

    let synthMIDI = getMidiConfig();

    if(synthMIDI !== null) {
        /* check if MIDI CC is already assigned */
        if(Object.values(synthMIDI).includes(value)) {
            let paramAssigned = Object.keys(synthMIDI).find(key => synthMIDI[key] == value);
            midiWarning.hidden = false;
            midiWarning.innerText = `MIDI CC already assigned to ${paramAssigned}, select another CC or clear mapping`;
            clearCC.hidden = false;
            clearCC.addEventListener("click", () => {
                delete synthMIDI[paramAssigned];
                localStorage.setItem('synthMIDI', JSON.stringify(synthMIDI));
                midiWarning.innerText = 'Cleared!';
                clearCC.hidden = true;
            });
        } else {
            synthMIDI[param] = value;
            midiWarning.innerText = `MIDI CC ${value} assigned to ${param}`;
        }

        localStorage.setItem('synthMIDI', JSON.stringify(synthMIDI));
    } else {
        localStorage.setItem('synthMIDI', JSON.stringify(paramConfig));
        midiWarning.innerText = `MIDI CC ${value} assigned to ${param}`;
    }


}

/* Get MIDI Config */
function getMidiConfig() {
    let synthMIDI = localStorage.getItem('synthMIDI');
    synthMIDI = JSON.parse(synthMIDI);

    return  synthMIDI;
}

/* Clear MIDI config  */
const clearAllMidi = document.querySelector("#clearAllMidi");
const confirmClear = document.querySelector("#confirm");
const cancelClear  =  document.querySelector("#cancel");

clearAllMidi.addEventListener("click", () => {
    confirmClear.hidden = false;
    cancelClear.hidden = false;
});

cancelClear.addEventListener("click", () => {
    confirmClear.hidden = true;
    cancelClear.hidden = true;
});

confirmClear.addEventListener("click", () => {
    localStorage.removeItem('synthMIDI');
    midiInfo.innerText = "Device connected!- Map your controller's MIDI CC";
});

/*
 * Functions for MIDI Mapping
 */

/* midi to frquency */
function midiNoteToFrequency(midiNote) {
    return Math.pow(2, (midiNote - 69) / 12) * 440;
}

/* midi cc to x param */
function midiCCMap(cc, min, max) {
    return ((cc / 127) * (max - min) + min).toFixed(2);
}

/* 
  MIDI to params config
*/

/* Master & Oscillators gains */
function midiToGains(gainNode, gain) {
    if(synth.audioCtx) {
        audioParams.gains[gainNode] = gain;
        gainFaders[gainNode].value = gain;
        gainFaders[gainNode].nextElementSibling.innerText = gain;

        synth.gainNodes[gainNode].gain.linearRampToValueAtTime(
            gain,
            synth.audioCtx.currentTime + 0.1
        );
    }
}

/* OSC frequencies  */
function midiCCtoOSCFreq(osc, freq) {
    if (synth.audioCtx) {
        audioParams.oscFreqs[osc] = freq;
        freqFaders[osc].value = freq;
        freqFaders[osc].nextElementSibling.innerText = freq + " Hz";
        synth.oscillators[osc].frequency.exponentialRampToValueAtTime(
            freq,
            synth.audioCtx.currentTime + 0.1
        );
    }
}

/* filter cut  */
function midiToFilterC(cut) {
    if (synth.audioCtx) {
        filterC.value = cut;
        filterC.nextElementSibling.innerText = cut + " Hz";
        synth.filter.frequency.exponentialRampToValueAtTime(
            cut,
            synth.audioCtx.currentTime + 0.2
        );
        audioParams.filter.cutoff = cut;
    }
}

/*  filter resonance */
function midiToFilterR(res) {
    if (synth.audioCtx) {
        filterR.value = res;
        filterR.nextElementSibling.innerText = res;
        synth.filter.Q.value = res;
        audioParams.filter.resonance = res;
    }
}

/* LFO rate */
function midiToLFORate(rate) {
    if (synth.audioCtx) {
        lfoRate.value = rate;
        synth.lfo.frequency.value = rate;
        lfoRate.nextElementSibling.innerText = rate;
        audioParams.lfo.rate = rate;
    }
}

/* LFO amt */
function midiToLFOAmt(amt) {
    if (synth.audioCtx) {
        lfoAmt.value = amt;
        synth.lfoGainNode.gain.value = amt;
        lfoAmt.nextElementSibling.innerText = amt;
        audioParams.lfo.amount = amt;
    }
}

/*
 *  Play notes
 */
let playedNotes = [];

function playNote(frequency) {
    freqFaders.forEach((e, i) => {
        e.value = frequency;
        audioParams.oscFreqs[i] = frequency;
        e.nextElementSibling.innerText = frequency + " Hz";

        if (synth.audioCtx) {
            synth.oscillators[i].frequency.value = frequency;
        }
    });

    if (audioParams.ADSR.active === true) {
        playedNotes.push(frequency);
    }

    if (playedNotes.length === 1 && audioParams.ADSR.active === true) {
        attackDecaySustain(
            audioParams.ADSR.attack,
            audioParams.ADSR.decay,
            audioParams.ADSR.sustain
        );
    }
}

function noteOff(frequency) {
    let position = playedNotes.indexOf(frequency);

    if (position !== -1) {
        playedNotes.splice(position, 1);
    }

    if (playedNotes.length === 0) {
        release(audioParams.ADSR.release);
    } else {
        synth.oscillators.forEach((oscillator) => {
            oscillator.frequency.value = playedNotes[playedNotes.length - 1];
        });
    }
}

/*
 * Envelope
 */
const EG = document.querySelector("#envelope");
const A = document.querySelector("#attack");
const D = document.querySelector("#decay");
const S = document.querySelector("#sustain");
const R = document.querySelector("#release");

activateEG.addEventListener("click", () => {
    EG.classList.toggle("disabled");
    activateEG.classList.toggle("on");
    activateEG.innerText = EG.classList.contains("disabled")
        ? "Activar envolvente"
        : "Desactivar envolvente";

    audioParams.ADSR.active = !audioParams.ADSR.active;

    updateParams();

    if (!EG.classList.contains("disabled") && synth.audioCtx) {
        noteOff();
    }
});

EG.addEventListener("input", updateEG);

function updateEG() {
    audioParams.ADSR.active = EG.classList.contains("disabled") ? false : true;

    let attack = parseFloat(A.value);
    A.nextElementSibling.innerText = attack;
    let decay = parseFloat(D.value);
    D.nextElementSibling.innerText = decay;
    let sustain = parseFloat(S.value);
    S.nextElementSibling.innerText = sustain;
    let releaseT = parseFloat(R.value);
    R.nextElementSibling.innerText = releaseT;

    audioParams.ADSR.attack = attack;
    audioParams.ADSR.decay = decay;
    audioParams.ADSR.sustain = sustain;
    audioParams.ADSR.release = releaseT;
}

function attackDecaySustain(attackTime, decayTime, sustainValue) {
    synth.gainNodes.forEach((gainNode, i) => {
        gainNode.gain.cancelScheduledValues(synth.audioCtx.currentTime);
        gainNode.gain.setValueAtTime(
            gainNode.gain.value,
            synth.audioCtx.currentTime
        );

        if (audioParams.gains[i] != 0 && audioParams.gains[0] != 0) {
            gainNode.gain.linearRampToValueAtTime(
                audioParams.gains[0],
                synth.audioCtx.currentTime + attackTime
            );

            let sustain = sustainValue * audioParams.gains[i];

            gainNode.gain.linearRampToValueAtTime(
                sustain,
                synth.audioCtx.currentTime + attackTime + decayTime
            );
        }
    });
}

function release(releaseTime) {
    synth.gainNodes.forEach((gainNode, i) => {
        gainNode.gain.cancelScheduledValues(synth.audioCtx.currentTime);
        gainNode.gain.setValueAtTime(
            gainNode.gain.value,
            synth.audioCtx.currentTime
        );
        gainNode.gain.linearRampToValueAtTime(
            0,
            synth.audioCtx.currentTime + releaseTime
        );
    });
}
