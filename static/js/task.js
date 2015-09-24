/*
 * Requires:
 *     psiturk.js
 *     utils.js
 */

// Initalize psiturk object
var psiTurk = PsiTurk(uniqueId, adServerLoc);

var mycondition = condition;  // these two variables are passed by the psiturk server process
var mycounterbalance = counterbalance;  // they tell you which condition you have been assigned to

var condition_name = "";
var ISI_LEVELS = [500,800,1100,1800]; // use each ISI for num_items_studied/4 items
var num_items_studied = 40;
var list_repetitions = 1;
var time_per_stimulus = 750;
var total_time = num_items_studied*list_repetitions*(time_per_stimulus+1000)/1000;
console.log("study period duration: "+total_time); // now +500 ms
// 2.5s per item + 500ms ISI per item should take 216 (3.6 min - 3:36) for 18 items

var IMG_DIR = "static/images/objects/";
var IMAGE_FILES = [];

for (var i = 1; i <= 72; i++) {
		IMAGE_FILES.push(IMG_DIR+i+".jpg");
}

// All pages to be loaded
var pages = [
	"instructions/instruct-1.html",
	"instructions/instruct-quiz.html",
	"instructions/instruct-ready.html",
	"instructions/instruct-test.html",
	"stage.html",
	"postquestionnaire.html"
];

psiTurk.preloadImages(IMAGE_FILES);

psiTurk.preloadPages(pages);

var instructionPages = [
	"instructions/instruct-1.html",
	"instructions/instruct-quiz.html",
	"instructions/instruct-ready.html"
];

var testInstructions = [
	"instructions/instruct-test.html"
];

var database = new Firebase('https://memtronome.firebaseio.com');
var dbstudy = database.child("study"); // store data from each phase separately
var dbtest = database.child("test");
var dbinstructq = database.child("instructquiz");
var dbpostq = database.child("postquiz");
// callback to let us know when a new message is added: database.on('child_added', function(snapshot) {
//	var msg = snapshot.val();
//	doSomething(msg.name, msg.text);
// });

/********************
* HTML manipulation
*
* All HTML files in the templates directory are requested
* from the server when the PsiTurk object is created above. We
* need code to get those pages from the PsiTurk object and
* insert them into the document.
*
********************/

var instructioncheck = function() {
	var corr = [0,0,0,0];
	if (document.getElementById('icheck1').checked) {corr[0]=1;}
	if (document.getElementById('icheck2').checked) {corr[1]=1;}
	if (document.getElementById('icheck3').checked) {corr[2]=1;}
	if (document.getElementById('icheck4').checked) {corr[3]=1;}
	var checksum = corr.reduce(function(tot,num){ return tot+num }, 0);
	console.log('instructquiz num_correct: ' + checksum);
	psiTurk.recordTrialData({'phase':'instructquiz', 'status':'submit', 'num_correct':checksum});
	var timestamp = new Date().getTime();
	dat = {'uniqueId':uniqueId, 'condnum':mycondition, 'phase':'instructquiz', 'num_correct':checksum, 'time':timestamp};
	dbinstructq.push(dat);

	if (checksum===4){
		document.getElementById("checkquiz").style.display = "none"; // hide the submit button
		document.getElementById("instructquizcorrect").style.display = "inline"; // show the next button
	} else {
		alert('You have answered some of the questions wrong. Please re-read instructions and try again.');
	}
}

var Experiment = function() {
	// make list of ISIs to use
	var ISIlevels = _.shuffle(ISI_LEVELS);
	var stim_per_ISI = num_items_studied/4;
	var ISI = [];
	for(i=0; i<ISIlevels.length; i++) {
		for(j=0; j<stim_per_ISI; j++) {
			ISI.push(ISIlevels[i]);
		}
	}
	var wordon, // time word is presented
	    listening = false;

	var ISItype;
	var shuffle_trials = false;
	if(mycondition==="0") {
		ISItype = 'blocked';
		condition_name = "blockedISI"; // maybe randomize if increasing or decreasing by block
	} else if(mycondition==="1") {
		ISItype = 'shuffled';
		condition_name = "shuffledISI";
		ISI = _.shuffle(ISI); // is this enough?
	}
	console.log("mycondition: "+mycondition+" condition_name: "+condition_name);

	var VERBAL_STIM = ["gasser", "coro", "plib", "bosa", "habble", "pumbi", "kaki", "regli", "permi",
		"gaso", "toma", "setar", "temi", "menick", "gosten", "fema", "gheck", "lanty", "ragol", "gelom",
		"feek", "rery", "galad", "bofe", "prino", "lano", "detee", "grup", "heca", "spati", "gidi", "pid",
		"bispit", "ceff", "netu", "mapoo", "colat", "patost", "rofe", "fofi", "molick", "spiczan", "slovy",
		"manu", "poda", "dorf", "vindi", "kupe", "nibo", "wug", "badu", "amma", "ghettle", "kala", "belmi",
		"lurf", "blug", "poove", "spret", "hoft", "prew", "nicote", "sanny", "jeba", "embo", "fexo", "woby",
		"dilla", "arly", "zear", "luli", "grum"]; // 72 words -- not matched to voiced stimuli

	var images = _.range(1,80);
	images = _.shuffle(images);
	objs = images.slice(0,num_items_studied); // to study
	var foil_inds = images.slice(num_items_studied+1, num_items_studied*2 +1 );
	console.log("num for study: "+objs.length+" num foils: "+foil_inds.length);

	//words = _.shuffle(VERBAL_STIM);
	var stimuli = []; // take first N
	for(i = 0; i<num_items_studied; i++) {
		stimuli.push({"obj":objs[i], "ISI":ISI[i], "index":i+1, "type":"old"}); // "word":words[i],
	}

	var trials = stimuli.slice(); // study trials
	console.log(trials);
	// add foils for test
	for( i = 0; i<num_items_studied; i++) {
		stimuli.push({"obj":foil_inds[i], "ISI":"NA", "index":0, "type":"new"});
	}
	stimuli = _.shuffle(stimuli);
	console.log(stimuli);


	var next = function() {
		if (trials.length===0) {
			finish();
		}
		else {
			var stim = trials.shift();
			//var time = stim.ISI;
			wordon = new Date().getTime();

			show_stim( [stim], time_per_stimulus + stim.ISI, wordon );
		}
	};

	var finish = function() {
	    // add a novel word/object pair for testing?
	    psiTurk.doInstructions(
    		testInstructions, // a list of pages you want to display in sequence
    		function() { currentview = new OldNewTest(stimuli); } // what you want to do when you are done with instructions
    	);
	};

	var record_study_trial = function(stim, wordon, key) {
		for(var i = 0; i < stim.length; i++) {
			var dat = {'uniqueId':uniqueId, 'condition':condition_name, 'phase':"STUDY", 'ISI':stim[i].ISI, 'index':stim[i].index,
				'obj':stim[i].obj, 'duration':time_per_stimulus, 'timestamp':wordon, 'keycode':key};
			//console.log(dat);
			psiTurk.recordTrialData(dat);
			dbstudy.push(dat);
		}
	};

	var show_stim = function(stim, time, wordon) {
		var recorded_flag = false;
		d3.select("body").on("keydown", function() {
			// 32 is space but let's record everything
			//if(d3.event.keyCode === 32) {	}
			record_study_trial(stim, wordon, d3.event.keyCode);
			recorded_flag = true;
		});

		//console.log(stim);
		var svg = d3.select("#visual_stim")
			.append("svg")
			.attr("width",250) // 480 if two stim
			.attr("height",250);

		svg.selectAll("image")
			.data(stim)
			.enter()
			.append("image")
      		.attr("xlink:href", function(d,i) { return IMG_DIR+d.obj+".jpg"; })
      		.attr("x", function(d,i) { return i*220+60 })
      		.attr("y", 10)
      		.attr("width",169)
      		.attr("height",169)
      		.style("opacity",1);

		// svg.selectAll("text")
		// 	.data(stim)
		// 	.enter()
		// 	.append("text")
		// 	.attr("x", function(d,i) { return i*220+50; })
		// 	.attr("y",180)
		// 	.style("fill",'black')
		// 	.style("text-align","center")
		// 	.style("font-size","50px")
		// 	.style("font-weight","200")
		// 	.style("margin","20px")
		// 	.text(function(d,i) { return d.word; });

		setTimeout(function() {
			if(!recorded_flag) { // record once if no keys were pressed
				record_study_trial(stim, wordon, -1);
			}
			remove_stim();
			setTimeout(function(){ next(); }, stim[0].ISI);
		}, time_per_stimulus); // time or time+ISI; ?
	};

	var remove_stim = function() {
		d3.select("svg").remove();
		// d3 transitions default to 250ms, and we probably don't want that fade..
		// d3.select("svg")
		// 	.transition()
		// 	.style("opacity", 0)
		// 	.remove();
	};


	// Load the stage.html snippet into the body of the page
	psiTurk.showPage('stage.html');
	// Start the test
	setTimeout(next(), 2000); // wait a bit to let the trial array be built...
};


var OldNewTest = function(stimuli) {
	// shuffle the words and present each one along with all of the objects
	// prompt them: "Choose the best object for"  (later: try choosing top two or three? or choose until correct?)
	stimuli = _.shuffle(stimuli); // shuffle...again
	//var all_objs = stimuli.slice(0);
	//all_objs = _.shuffle(all_objs); // and shuffle the object array
	var test_index = 0;

	var finish = function() {
	    $("body").unbind("keydown", response_handler); // Unbind keys
	    currentview = new Questionnaire();
	};

	var next = function() {
		if (stimuli.length===0) {
			finish();
		}
		else {
			var stim = stimuli.shift(); // remove words as tested
			test_index++;
			show_test( stim );
		}
	};

	var show_test = function( stim ) {
		wordon = new Date().getTime();
		var recorded_flag = false;
		var correct = 0;
		var response = -1;

		var svg = d3.select("#visual_stim")
			.append("svg")
			.attr("width",250)
			.attr("height",250);

		d3.select("body").on("keydown", function() {
			var valid_key = false;
			var rt = new Date().getTime() - wordon;
			// 32 is space but let's record everything
			if(d3.event.keyCode === 81) {	// 'Q'
				valid_key = true;
				response = 'new';
				if(stim.type==='new') correct = 1;
			} else if(d3.event.keyCode === 80) { // 'P'
				valid_key = true;
				response = 'old';
				if(stim.type==='old') correct = 1;
			}

			if(valid_key) {
				var dat = {'condition':condition_name, 'phase':"TEST", 'testIndex':test_index, 'studyIndex':stim.index, 'ISI':stim.ISI,
					'stimId':stim.obj, 'correctAns':stim.type, 'response':response, 'correct':correct, 'rt':rt};
				//console.log(dat);
				psiTurk.recordTrialData(dat);
				dat.uniqueId = uniqueId;
				dat.timestamp = wordon;
				dbtest.push(dat);
				remove_stim();
				setTimeout(function(){ next(); }, 500); // always 500 ISI
			} // wait for a valid keypress
		});

		//d3.select("#prompt").html('<h1>Click on the '+ stim.word +'</h1>');
		d3.select("#prompt").html('<h1>Q = New,   P = Old</h1>');

		svg.selectAll("image")
			.data([stim])
			.enter()
			.append("image")
		  		.attr("xlink:href", function(d,i) { return IMG_DIR+d.obj+".jpg"; })
		  		.attr("x", function(d,i) { return i*220+60 })
		  		.attr("y", 10)
		  		.attr("width",169)
		  		.attr("height",169)
		  		.style("opacity",1);


	};

	var remove_stim = function() {
		d3.select("svg").remove();
	};

	psiTurk.showPage('stage.html');
	next();
};


function getRandomSubarray(arr, size) {
    var shuffled = arr.slice(0), i = arr.length, temp, index;
    while (i--) {
        index = Math.floor((i + 1) * Math.random());
        temp = shuffled[index];
        shuffled[index] = shuffled[i];
        shuffled[i] = temp;
    }
    return shuffled.slice(0, size);
}


/****************
* Questionnaire *
****************/

var Questionnaire = function() {
	var error_message = "<h1>Oops!</h1><p>Something went wrong submitting your HIT. This might happen if you lose your internet connection. Press the button to resubmit.</p><button id='resubmit'>Resubmit</button>";

	record_responses = function() {
		psiTurk.recordTrialData({'phase':'postquestionnaire', 'status':'submit'});
		dat = {'uniqueId':uniqueId, 'condition':condition_name, 'phase':'postquestionnaire'};
		$('textarea').each( function(i, val) {
			psiTurk.recordUnstructuredData(this.id, this.value);
			dat[this.id] = this.value;
		});
		$('select').each( function(i, val) {
			psiTurk.recordUnstructuredData(this.id, this.value);
			dat[this.id] = this.value;
		});
		dbpostq.push(dat);
	};

	prompt_resubmit = function() {
		document.body.innerHTML = error_message; // d3.select("body")
		$("#resubmit").click(resubmit);
	};

	resubmit = function() {
		document.body.innerHTML = "<h1>Trying to resubmit...</h1>";
		reprompt = setTimeout(prompt_resubmit, 10000);

		psiTurk.saveData({
			success: function() {
			    clearInterval(reprompt);
                //psiTurk.computeBonus('compute_bonus', function(){}); // was finish()
								psiTurk.completeHIT();
			},
			error: prompt_resubmit
		});
	};


	// Load the questionnaire snippet
	psiTurk.showPage('postquestionnaire.html');
	psiTurk.recordTrialData({'phase':'postquestionnaire', 'status':'begin'});

	$("#next").click(function () {
	    record_responses();
	    psiTurk.saveData({
            success: function(){
                //psiTurk.computeBonus('compute_bonus', function() {
						    psiTurk.completeHIT();
            },
            error: prompt_resubmit});
	});

};

// Task object to keep track of the current phase
var currentview;

/*******************
 * Run Task
 ******************/
$(window).load( function(){
    psiTurk.doInstructions(
    	instructionPages, // a list of pages you want to display in sequence
    	function() { currentview = new Experiment(); } // what you want to do when you are done with instructions
    );
});
