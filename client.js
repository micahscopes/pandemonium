//
//Copyright (c) 2014, Priologic Software Inc.
//All rights reserved.
//
//Redistribution and use in source and binary forms, with or without
//modification, are permitted provided that the following conditions are met:
//
//    * Redistributions of source code must retain the above copyright notice,
//      this list of conditions and the following disclaimer.
//    * Redistributions in binary form must reproduce the above copyright
//      notice, this list of conditions and the following disclaimer in the
//      documentation and/or other materials provided with the distribution.
//
//THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
//AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
//IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
//ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
//LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
//CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
//SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
//INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
//CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
//ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
//POSSIBILITY OF SUCH DAMAGE.
//
var selfEasyrtcid = "";
var connectList = {};
var channelIsActive = {}; // tracks which channels are active
var usernameField;
var midi;

function init() { /* onload */
	usernameField = document.getElementById("username");
	midiInit(onMIDISuccess,onMIDIFailure);
	//usernameField.oninput = updateUsername;
}

function onMIDIFailure(msg) {
  console.log( "Failed to get MIDI access - " + msg );
}

function onMIDISuccess(midiAccess) {
	console.log( "MIDI ready!" );
	midi = midiAccess;  // store in the global (in real usage, would probably keep in an object instance)
	ioConfiguration();
}

function disconnect() {
	easyrtc.disconnect();
}

function connect() {
	//setTimeout( function(){
		var username = usernameField.value;
		easyrtc.setUsername(username);
		easyrtc.enableDebug(false);
		easyrtc.enableDataChannels(true);
		easyrtc.enableVideo(false);
		easyrtc.enableAudio(false);
		easyrtc.enableVideoReceive(false);
		easyrtc.enableAudioReceive(false);
		easyrtc.setDataChannelOpenListener(openListener);
		easyrtc.setDataChannelCloseListener(closeListener);
		easyrtc.setPeerListener(handleIncomingMessage);
		easyrtc.setRoomOccupantListener(convertListToButtons);
		easyrtc.connect("easyrtc.dataMessaging", loginSuccess, loginFailure);
	//}, 200 );
}

function handleIncomingMessage(who, mstType, content) {
	midi.outputs.forEach(function(o){
		if (o.enabled) {
			o.send(content);
			addToConversation(who, msgType, content)
		}
	});
}
function addToConversation(who, msgType, content) {
    // Escape html special characters, then add linefeeds.
    content = JSON.stringify(content);
    content = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    content = content.replace(/\n/g, '<br />');
    document.getElementById('conversation').innerHTML +=
            "<b>" + easyrtc.idToName(who) + ":</b>&nbsp;" + content + "<br />";
}


function openListener(otherParty) {
    channelIsActive[otherParty] = true;
    updateButtonState(otherParty);
}


function closeListener(otherParty) {
    channelIsActive[otherParty] = false;
    updateButtonState(otherParty);
}

function ioConfiguration() {
	var inputsConfigArea = document.getElementById('inputsConfig');
	for (var i in midi.inputs()) {
		var checkbox,label;
		var id = "inputCheck"+i;
		var input = midi.inputs()[i];
		label = document.createElement('label');
		checkbox = document.createElement('input');
		checkbox.id = id;
		checkbox.type = "checkbox";
		inputsConfigArea.appendChild(label);
		label.appendChild(checkbox);
		label.innerHTML += input.name;
		
		checkbox.onchange = function(e) {
			if(e.target.checked) {
				listenForMIDI(midi,midi.inputs()[i],handleLocalMIDI);
			} else {
				listenForMIDI(midi,midi.inputs()[i]); 
			}
		}
	}
	
	var outputsConfigArea = document.getElementById('outputsConfig');
	for (var i in midi.outputs()) {
		var checkbox,label;
		var id = "outputCheck"+i;
		var output = midi.outputs()[i];
		label = document.createElement('label');
		label.for = id;
		checkbox = document.createElement('input');
		checkbox.id = id;
		checkbox.type = "checkbox";
		label.appendChild(checkbox);
		outputsConfigArea.appendChild(label);
		label.innerHTML += output.name;
		checkbox.onchange = function(e) {
			e.target.associated.enabled = midi.outputs()[i].checked;
		}
	}
	
	
}

function convertListToButtons(roomName, occupantList, isPrimary) {
    connectList = occupantList;

    var otherClientDiv = document.getElementById('otherClients');
    while (otherClientDiv.hasChildNodes()) {
        otherClientDiv.removeChild(otherClientDiv.lastChild);
    }
	
    var label, button;
    for (var easyrtcid in connectList) {
        var rowGroup = document.createElement("div");
        var rowLabel = document.createTextNode(easyrtc.idToName(easyrtcid));
        rowGroup.appendChild(rowLabel);

        button = document.createElement('button');
        button.id = "connect_" + easyrtcid;
        button.onclick = function(easyrtcid) {
            return function() {
                startCall(easyrtcid);
            };
        }(easyrtcid);
        label = document.createTextNode("Connect");
        button.appendChild(label);
        rowGroup.appendChild(button);

        button = document.createElement('button');
        button.id = "send_" + easyrtcid;
        button.onclick = function(easyrtcid) {
            return function() {
                sendStuffP2P(easyrtcid);
            };
        }(easyrtcid);
        label = document.createTextNode("Send Message");
        button.appendChild(label);
        rowGroup.appendChild(button);
        otherClientDiv.appendChild(rowGroup);
        updateButtonState(easyrtcid);
    }
    if (!otherClientDiv.hasChildNodes()) {
        otherClientDiv.innerHTML = "<em>Nobody else logged in to talk to...</em>";
    }
}

function updateButtonState(otherEasyrtcid) {
    var isConnected = channelIsActive[otherEasyrtcid];
    if(document.getElementById('connect_' + otherEasyrtcid)) {
        document.getElementById('connect_' + otherEasyrtcid).disabled = isConnected;
    }
    if( document.getElementById('send_' + otherEasyrtcid)) {
        document.getElementById('send_' + otherEasyrtcid).disabled = !isConnected;
    }
}

function startCall(otherEasyrtcid) {
    if (easyrtc.getConnectStatus(otherEasyrtcid) === easyrtc.NOT_CONNECTED) {
        try {
        easyrtc.call(otherEasyrtcid,
                function(caller, media) { // success callback
                    if (media === 'datachannel') {
                        // console.log("made call succesfully");
                        connectList[otherEasyrtcid] = true;
                    }
                },
                function(errorCode, errorText) {
                    connectList[otherEasyrtcid] = false;
                    easyrtc.showError(errorCode, errorText);
                },
                function(wasAccepted) {
                    // console.log("was accepted=" + wasAccepted);
                }
        );
        }catch( callerror) {
            console.log("saw call error ", callerror);
        }
    }
    else {
        easyrtc.showError("ALREADY-CONNECTED", "already connected to " + easyrtc.idToName(otherEasyrtcid));
    }
}


function sendToConnected(data) {
	for (var k in connectList) {
		if (easyrtc.getConnectStatus(k) === easyrtc.IS_CONNECTED) {
			easyrtc.sendDataP2P(k, 'msg', data);
		}
    }
}

function handleLocalMIDI(e) {
	sendToConnected(e.data);
}

function sendStuffP2P(otherEasyrtcid) {
    var text = document.getElementById('sendMessageText').value;
    if (text.replace(/\s/g, "").length === 0) { // Don't send just whitespace
        return;
    }
    if (easyrtc.getConnectStatus(otherEasyrtcid) === easyrtc.IS_CONNECTED) {
        easyrtc.sendDataP2P(otherEasyrtcid, 'msg', text);
    }
    else {
        easyrtc.showError("NOT-CONNECTED", "not connected to " + easyrtc.idToName(otherEasyrtcid) + " yet.");
    }

    addToConversation("Me", "msgtype", text);
    document.getElementById('sendMessageText').value = "";
}


function loginSuccess(easyrtcid) {
    document.getElementById("iam").innerHTML = "I am " + easyrtc.idToName(easyrtcid) +" ("+easyrtcid+").";
}


function loginFailure(errorCode, message) {
    easyrtc.showError(errorCode, "failure to login");
}
