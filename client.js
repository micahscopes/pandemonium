var selfEasyrtcid = "";
var connectList = {};
var channelIsActive = {}; // tracks which channels are active
var usernameField;
var midi;
var midiOutputs;
var midiInputs;

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
	midiInputs = midi.inputs();
	midiOutputs = midi.outputs();
	ioConfiguration();
}

function disconnect() {
	easyrtc.disconnect();
}

function connect() {
	//setTimeout( function(){
		var username = usernameField.value;
		easyrtc.setUsername(username);
		easyrtc.enableDataChannels(true);
		easyrtc.enableVideo(false);
		easyrtc.enableVideoReceive(false);		
		easyrtc.enableAudio(false);
		easyrtc.enableAudioReceive(false);
		easyrtc.setDataChannelOpenListener(openListener);
		easyrtc.enableDebug(false);
		easyrtc.setDataChannelCloseListener(closeListener);
		easyrtc.setPeerListener(handleIncomingMessage);
		easyrtc.setRoomOccupantListener(convertListToButtons);
		easyrtc.connect("easyrtc.dataMessaging", loginSuccess, loginFailure);
	//}, 200 );
}

function handleIncomingMessage(who, mstType, content) {
	midiOutputs.forEach(function(o){
		if(o.enabled) {
			var c = content;
			o.send(new Uint8Array([c[0],c[1],c[2]]));
		}
	});
	addToConversation(content,who);
}

function addToConversation(content,who) {
	content = JSON.stringify(content);
    content = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    content = content.replace(/\n/g, '<br />');
    document.getElementById('conversation').innerHTML =
    "<b>" + easyrtc.idToName(who) + ":</b>&nbsp;" + content + "<br />" + 
    document.getElementById('conversation').innerHTML;
    var length = 5000;
	document.getElementById('conversation').innerHTML = 
		document.getElementById('conversation').innerHTML.substring(0,length)+"...";
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
	midiInputs.forEach(function(input,i) {
		var checkbox,label;
		var id = "inputCheck"+i;
		label = document.createElement('label');
		checkbox = document.createElement('input');
		checkbox.id = id;
		checkbox.type = "checkbox";
		inputsConfigArea.appendChild(label);
		label.appendChild(checkbox);
		label.appendChild(document.createTextNode(input.name));
		checkbox = document.getElementById(id);
		checkbox.onchange = function(e) {
			if(e.target.checked) {
				listenForMIDI(midi,input,handleLocalMIDI);
			} else {
				listenForMIDI(midi,input); 
			}
		}
	});
	
	var outputsConfigArea = document.getElementById('outputsConfig');
	midiOutputs.forEach(function(output,i) {
		var checkbox,label;
		var id = "outputCheck"+i;
		label = document.createElement('label');
		label.for = id;
		checkbox = document.createElement('input');
		checkbox.id = id;
		checkbox.type = "checkbox";
		label.appendChild(checkbox);
		outputsConfigArea.appendChild(label);
		label.appendChild(document.createTextNode(output.name));
		checkbox.onchange = function(e) {
			 output.enabled = e.target.checked;
		}
	});
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
        var rowLabel = document.createElement("b");
        rowLabel.innerHTML = easyrtc.idToName(easyrtcid);
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
        document.getElementById('connect_' + otherEasyrtcid).innerHTML = (isConnected ? "Disconnect" : "Connect");
        if(!isConnected) {
			document.getElementById('connect_' + otherEasyrtcid).onclick =
			function(easyrtcid) {
				return function() {
					startCall(easyrtcid);
				};
			}(otherEasyrtcid);
		} else {
			document.getElementById('connect_' + otherEasyrtcid).onclick =
			function(easyrtcid) {
				return function() {
					easyrtc.hangup(easyrtcid);
				};
			}(otherEasyrtcid);
		}
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

    addToConversation(text,"me");
    document.getElementById('sendMessageText').value = "";
}


function loginSuccess(easyrtcid) {
    document.getElementById("usernameConfig").innerHTML = "<h3>"+easyrtc.idToName(easyrtcid)+"</h3>";
    document.getElementById("iam").innerHTML = "";
}


function loginFailure(errorCode, message) {
    easyrtc.showError(errorCode, "failure to login");
}
