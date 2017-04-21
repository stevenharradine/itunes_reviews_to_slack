var dataSource = "file"
var fs = require('fs')

var history;
var newReviews = [];
var app_icon = ""

var itunes_country = process.argv[2]
var itunes_id = process.argv[3]
var slack_channel = process.argv[4]
var slack_token = process.argv[5]

readHistory ()

function readHistory () {
	fs.readFile('history.json', 'utf8', function (err,data) {
	  if (err) {
	    return console.log(err)
	  }
	  history = JSON.parse (data);
	  readReviews ()
	})	
}

function readReviews () {
	if (dataSource == "file") {
		fs.readFile('stub.json', 'utf8', function (err,data) {
		  if (err) {
		    return console.log(err)
		  }
		  processReviews (data)
		})
	} else {
		var https = require('https')
		var options = {
		  host: 'itunes.apple.com',
		  port: 443,
		  path: "/" + itunes_country + "/rss/customerreviews/id=" + itunes_id + "/sortBy=mostRecent/json",
		  method: 'GET'
		}

		var req = https.request(options, function(res) {
		  var buffer = ""
		  res.on('data', function(d) {
		    buffer += d
		  })
		  response.on('end', function () {
		    processReviews (buffer)
		  })
		})
		req.end();

		req.on('error', function(e) {
		  console.error(e);
		})
	}
}

function processReviews (jsonStr) {
	var json = JSON.parse (jsonStr)
	app_icon = json.feed.entry[0]["im:image"][0].label

	json.feed.entry.forEach(function (review) {
		if (review.author != undefined) {
			var isFound = false
			history.forEach(function (historicalReview) {
				var isAuthor = review.author.name.label == historicalReview.name
				var isTitle = review.title.label == historicalReview.title
				var isContent = review.content.label == historicalReview.content
				
				isFound = isAuthor || isTitle || isContent ? true : isFound
			})

			if (!isFound) {
				var reviewJSON = {}
				reviewJSON.name = review.author.name.label
				reviewJSON.title = review.title.label
				reviewJSON.content = review.content.label
				reviewJSON.rating = review["im:rating"].label
				reviewJSON.version = review["im:version"].label

				addNewReview (reviewJSON)
			}
		}
	})

	sendToSlack ()
}

function sendToSlack () {
	var Slack = require('slack-node');
	var slackBuffer = ""

	if (newReviews.length > 0) {
		newReviews.forEach(function (review) {
			slackBuffer += "Name: " + review.name + "\n"
			slackBuffer += "Version: " + review.version + "\n"
			slackBuffer += "Rating: " + review.rating + "\n"
			slackBuffer += "Title: " + review.title + "\n"
			slackBuffer += "Content: " + review.content + "\n"
			slackBuffer += "\n"
		})
		 
		webhookUri = "https://hooks.slack.com/services/" + slack_token;
		 
		slack = new Slack();
		slack.setWebhook(webhookUri);
		 
		slack.webhook({
		  channel: slack_channel,
		  username: "iOS Review Bot",
		  icon_emoji: app_icon,
		  text: slackBuffer
		}, function(err, response) {
		  console.log(response);
		});
	}
}

function addNewReview (reviewJSON) {
	console.log ("new")
	newReviews.push (reviewJSON)
	history.push (reviewJSON)
	writeHistory()
}

function writeHistory () {
	fs.writeFile("history.json", JSON.stringify (history), function(error) {
	     if (error) {
	       console.error("write error:  " + error.message)
	     }
	})
}

