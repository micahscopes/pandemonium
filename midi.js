var midi = null;  // global MIDIAccess object

function midiInit(onMIDISuccess,onMIDIFailure) {
	navigator.requestMIDIAccess().then( onMIDISuccess, onMIDIFailure );
}

function listInputsAndOutputs( midiAccess ) {
  for (var input in midiAccess.inputs) {
    console.log( "Input port [type:'" + input.type + "'] id:'" + input.id +
      "' manufacturer:'" + input.manufacturer + "' name:'" + input.name +
      "' version:'" + input.version + "'" );
  }

  for (var output in midiAccess.outputs) {
    console.log( "Output port [type:'" + output.type + "'] id:'" + output.id +
      "' manufacturer:'" + output.manufacturer + "' name:'" + output.name +
      "' version:'" + output.version + "'" );
  }
}

function listenForMIDI( midiAccess, input, handler ) {
	input.onmidimessage = handler;
}

