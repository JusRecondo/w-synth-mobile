/* 
*   MIDI (Web MIDI API) 
*/
if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess()
    .then(onMIDIsuccess, onMIDIfailure);
}

function onMIDIsuccess (midi) {  
    
    const midiInfo = document.querySelector('#midi-info');
   
    if(midi.inputs.size !== 0) {
        midiInfo.innerText = 'Device connected!';
    } else {
        midiInfo.innerText = 'No device connected, connect your device and reload page.';
    }

    let inputs = midi.inputs.values();

    for(let input = inputs.next(); input && !input.done; input = inputs.next() ) {
        input.value.onmidimessage = onMIDIMessage;
    }
}

function onMIDIfailure () {
    console.error('No access to your midi devices.');
}


function onMIDIMessage(message) {
    let frequency = midiNoteToFrequency(message.data[1]).toFixed(2);
   /*  console.log(message.data); */
    
    if(synth.audioCtx) {
        /* 144 midi message for noteOn */
        if (message.data[0] === 144 && message.data[2] > 0) {
            playNote(frequency);
        }
    
        /* 128 midi message fot noteOff */
        if ( (message.data[0] === 128 && message.data[2] === 0) &&
             (audioParams.ADSR.active === true) ) {
            noteOff(frequency);
        }    
    }

    //midi to filter cut
    //AKAI CC 9
    if(message.data[1] === 9) {
        let midiInput = midiCCMap( message.data[2], 100, 12000);
        midiToFilterC(midiInput);
    } 

    //midi to filter res
    //AKAI CC10
    if (message.data[1] === 10 ){
        let midiInput = midiCCMap(message.data[2], 0, 30);
        midiToFilterR(midiInput);
    }

    //midi to LFO RATE
    //AKAI CC11
    if (message.data[1] === 11 ){
        let midiInput = midiCCMap(message.data[2], 0.1, 15);
        midiToLFORate(midiInput);
    }

    //midi to LFO AMT
    //AKAI CC12
    if (message.data[1] === 12 ){
        let midiInput = midiCCMap(message.data[2], 0.5, 1000);
        midiToLFOAmt(midiInput);
    }

    //midi to master gain
    if(message.data[1] === 13) {
        let gainInput = midiCCMap(message.data[2], 0, 0.5);
        midiToMaster(parseFloat(gainInput));
    }

    if(message.data[1] === 14 ||
       message.data[1] === 15 ||
       message.data[1] === 16) {
           let freq = midiCCMap(message.data[2], 40, 1000);           
           midiCCtoOSCFreq(freq, message.data[1]);           
       }

}

/* 
* MIDI Mapping
*/
/* midi to frquency */
function midiNoteToFrequency(midiNote) {
    return Math.pow(2, ( (midiNote - 69) / 12 ) ) * 440;
}

/* midi cc to x param */
function midiCCMap( cc, min, max ) {
    return ( (cc / 127) * (max - min) + min).toFixed(2);
}

/* master gain */
function midiToMaster(vol) {
    if(synth.audioCtx) {
        audioParams.gains[0]       = vol;
        gainFaders[0].value = vol;
        gainFaders[0].nextElementSibling.innerText = vol;
        synth.gainNodes[0].gain.linearRampToValueAtTime(
            vol,
            synth.audioCtx.currentTime + 0.1
          );

    }
}

/* OSC frequencies  */
function midiCCtoOSCFreq(freq, osc) {
    let freqOsc = {
        14: 0,
        15: 1,
        16: 2
    }
    if(synth.audioCtx) {
        let oscN = freqOsc[osc];
        audioParams.oscFreqs[oscN]    = freq;
        freqFaders[oscN].value = freq;
        freqFaders[oscN].nextElementSibling.innerText = freq + ' Hz';
        synth.oscillators[oscN].frequency.exponentialRampToValueAtTime(freq, synth.audioCtx.currentTime + 0.1);
    }

}

/* filter cut  */
function midiToFilterC(cut) {
    if (synth.audioCtx) {
        filterC.value = cut;
        filterC.nextElementSibling.innerText = cut + ' Hz';
        synth.filter.frequency.exponentialRampToValueAtTime(cut, synth.audioCtx.currentTime + 0.2);
        audioParams.filter.cutoff    = cut;
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
* Play notes
*/
let playedNotes = [];

function playNote(frequency) {

    freqFaders.forEach( (e, i) => {
        e.value = frequency;
        audioParams.oscFreqs[i] = frequency;
        e.nextElementSibling.innerText = frequency + ' Hz';

        if(synth.audioCtx) {
            synth.oscillators[i].frequency.value = frequency;
        }
    });
    
    if (audioParams.ADSR.active === true) {
        playedNotes.push(frequency);
    }

    if (playedNotes.length === 1 && audioParams.ADSR.active === true) { 
        attackDecaySustain(audioParams.ADSR.attack, audioParams.ADSR.decay, audioParams.ADSR.sustain);
    }
}

function noteOff(frequency) {
    let position = playedNotes.indexOf(frequency);

    if(position !== -1) {
        playedNotes.splice(position, 1);
    }  

    if (playedNotes.length === 0) {
        release(audioParams.ADSR.release);
    } else {
        synth.oscillators.forEach((oscillator) => {
            oscillator.frequency.value = playedNotes[playedNotes.length -1];
        } )
    }
}

/* 
* Envelope 
*/
const EG = document.querySelector('#envelope');
const A = document.querySelector('#attack');
const D = document.querySelector('#decay');
const S = document.querySelector('#sustain');
const R = document.querySelector('#release');

const activateEG = document.querySelector('#activate-eg-btn');

activateEG.addEventListener('click', () => {
    EG.classList.toggle('disabled');
    activateEG.classList.toggle('on');
    activateEG.innerText = EG.classList.contains('disabled') ? 'Activar envolvente' : 'Desactivar envolvente';

    audioParams.ADSR.active = !audioParams.ADSR.active;

    updateParams();

    if ( !EG.classList.contains('disabled') && synth.audioCtx) {
        noteOff();
    }
});

EG.addEventListener('input', updateEG);

function updateEG () {
    audioParams.ADSR.active = EG.classList.contains('disabled') ? false : true;

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
        gainNode.gain.setValueAtTime(gainNode.gain.value, synth.audioCtx.currentTime);

        if (audioParams.gains[i] != 0 && audioParams.gains[0] != 0) {
            gainNode.gain.linearRampToValueAtTime(audioParams.gains[0], synth.audioCtx.currentTime + attackTime);

            let sustain = sustainValue * audioParams.gains[i];
    
            gainNode.gain.linearRampToValueAtTime(sustain, synth.audioCtx.currentTime + attackTime + decayTime); 
        }

    })

}

function release(releaseTime) {
    synth.gainNodes.forEach((gainNode, i) => {
        gainNode.gain.cancelScheduledValues(synth.audioCtx.currentTime);
        gainNode.gain.setValueAtTime(gainNode.gain.value, synth.audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, synth.audioCtx.currentTime + releaseTime);
    })
}

