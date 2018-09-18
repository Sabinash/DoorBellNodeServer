var express = require('express');
var request = require("request");
var firebase = require('firebase');
var admin = require("firebase-admin");
const Gpio = require('onoff').Gpio;
var NodeWebcam = require( "node-webcam" );


var app = express();

var router = express.Router();
    
	fireBaseInit();
	turnOnLedWithSwitch();
	
	function turnOnLedWithSwitch(){
		console.log("push button");
		var LED = new Gpio(18, 'out');
		var pushButton = new Gpio(17, 'in','both'); 
		pushButton.watch(function (err, value) { 
				if (err) { 	
					console.error('There was an error', err); 
					return;
				}
				LED.writeSync(value);
			console.log("push button :: "+value);
			captureImage();
			
		});

		function unexportOnClose() { //function to run when exiting program
		LED.writeSync(0); // Turn LED off
		LED.unexport(); // Unexport LED GPIO to free resources
		pushButton.unexport(); // Unexport Button GPIO to free resources
		};

		process.on('SIGINT', unexportOnClose); //function to run when user closes using ctrl+c
	}
	
	function captureImage(){
		
		//Default options

		var opts = {

		//Picture related

		width: 1280,

		height: 720,

		quality: 100,


		//Delay to take shot

		delay: 0,


		//Save shots in memory

		saveShots: true,


		// [jpeg, png] support varies
		// Webcam.OutputTypes

		output: "jpeg",


		//Which camera to use
		//Use Webcam.list() for results
		//false for default device

		device: false,


		// [location, buffer, base64]
		// Webcam.CallbackReturnTypes

		callbackReturn: "location",


		//Logging

		verbose: false

		};


		//Creates webcam instance

		var Webcam = NodeWebcam.create( opts );


		//Will automatically append location output type

		Webcam.capture( "test_picture", function( err, data ) {} );


		//Also available for quick use

		NodeWebcam.capture( "test_picture", opts, function( err, data ) {

		});


		//Get list of cameras

		Webcam.list( function( list ) {

		//Use another device

		var anotherCam = NodeWebcam.create( { device: list[ 0 ] } );
			console.log("anotherCam :: "+ JSON.stringify(anotherCam))
		});

		//Return type with base 64 image

		var opts = {
		callbackReturn: "base64"
		};

		NodeWebcam.capture( "test_picture", opts, function( err, data ) {

		var image = "<img src='" + data + "'>";
		console.log("imagePath :: "+ image);
		uploadCapturedImageToFireBaseBucket();

		});
		
	}
	
	function fireBaseInit(){
		
		/* Initialize Firebase Starts */
		var config = {
		apiKey: "AIzaSyBr3Ysy32IxPHdXzNRj2ih-QZyGmHXHBdU",
		authDomain: "myraspdoorbell.firebaseapp.com",
		databaseURL: "https://myraspdoorbell.firebaseio.com",
		projectId: "myraspdoorbell",
		storageBucket: "myraspdoorbell.appspot.com",
		messagingSenderId: "758874340479"
		};
		firebase.initializeApp(config);

		admin.initializeApp({
		  credential: admin.credential.cert("./myraspdoorbell-firebase-adminsdk-miycg-92f56038ae.json"),
		  databaseURL: "https://myraspdoorbell.firebaseio.com",
		  storageBucket: "gs://myraspdoorbell.appspot.com"
		});
	/* Initialize Firebase Ends */
		
	}
	
	function uploadCapturedImageToFireBaseBucket(){
		var bucket = admin.storage().bucket();
		var localFilename = 'test_picture.jpg';
		bucket.upload(localFilename, function(err, file) {
		if (!err) {
		console.log('uploaded file is now in your bucket.' );
			return file.getSignedUrl({
			action: 'read',
			expires: '03-09-2491'
			}).then(signedUrls => {
				console.log(signedUrls[0]);
				saveToDataBase(signedUrls[0]);
				sendNotification(signedUrls[0]);
			});
		} else {
		console.log('Error uploading file: ' + err);
		}
		});
	}

app.get('/', function (req, res) {
	turnOnLedWithSwitch();
	res.send("Hello World");
})

app.get('/captureImage', function (req, res) {
	uploadCapturedImageToFireBaseBucket();
	res.send("Hello World");
})

function saveToDataBase(returnedUrlFromFireBase){
	
	var db = firebase.database();
	var ref = db.ref("myraspdoorbell");
	ref.once("value", function(snapshot) {
		console.log(snapshot.val());
	});
    
	firebase.database().ref('myraspdoorbell/' + getImageCapturedTime()).set({
    title: "SomeOne At the Door",
	body: getImageCapturedTime(),
	imgUrl:returnedUrlFromFireBase
  });
}


function getImageCapturedTime(){
	
	return new Date().toLocaleString();
}


  function sendNotification(returnedUrlFromFireBase){
   console.log("Got a POST request for sendNotification");
    var FCMAuthToken = "AIzaSyC3AqDYbsLSNPDRsc7WP69ve6ip5ukYLso";
	var notificationMessage = "SomeOne At the Door";
	var title = getImageCapturedTime();
	var imageUrl = returnedUrlFromFireBase;
	var responseResult;
	var body = {
		"data": {
			"title": title,
			"body": notificationMessage,
			"imgUrl":imageUrl
		},
		"to": "/topics/notifyatdoor",
		"priority": "high",
		"restricted_package_name": "com.sekhartech.rasppidoorbell"
	}
	request.post({
    "headers": { 'Content-Type': 'application/json', 'Authorization': 'key=' + FCMAuthToken },
    "url": "https://fcm.googleapis.com/fcm/send",
    "body": JSON.stringify(body)
	}, (error, response, body) => {
    if(error) {
		responseResult = error;
        return responseResult;
    }
    console.dir(JSON.parse(body));
	responseResult = JSON.parse(body);
	return responseResult;
	});
   
  }

var server = app.listen(3000, process.env.OPENSHIFT_NODEJS_IP || process.env.IP || '127.0.0.1',function () {  // set our port
	var host = server.address().address
	var port = server.address().port
	console.log("Example app listening at http://%s:%s", host, port)
});


