/*
db schema:

users
{
	id,
	username,
	password,
	following: [userId1, userId2, userId3], 
	posts: 
	[
		id: ObjectId(),
		date: new Date(),
		title: "",
		description: "",
		route: 
		[
			{lat: 1, lon: 1}
		],
		pics: 
		[
			{}
		]
	]
}

*/

var express = require('express');
var bodyParser = require('body-parser');
var crypto = require('crypto');

var app = module.exports = express();

app.use(bodyParser());

var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;

var connectionString = "mongodb://localhost:27017/motoProto";

var token2username = {};

app.get('/register', function(req, res){
});

app.get('/logout', function(req, res){
});

var loggedUsers = {};

app.post('/login', function(req, res){
	var username = req.body.username;
	var password = req.body.password;
	
	MongoClient.connect(connectionString, function(err, db) {
		var passwordHash = crypto.createHash('md5').update(password).digest('hex');
		db.collection("users").findOne({username : username, password: passwordHash}, function(err, user) {
			if (user) {
				var userToken = crypto.randomBytes(20).toString('hex');
				var userId = user._id.toString();
				loggedUsers[userToken] = userId;
				
				res.send({
					success : true,
					userToken: userToken,
					msg : "OK",
				});
			} else {
				res.send({                
					success : false, 
					msg: "Authentication failed! Bad username or password"
				});
			}
			
			db.close();
		});
	});
});

//gets all user's posts plus all the posts of the users he follows
//TODO: should get portions, not all at once
app.get('/:userToken/posts', function(req, res) {
	var userToken = req.params.userToken;
	
	if (!loggedUsers[userToken]) {
		res.send({                
			success : false, 
			msg: "Invalid user token"
		});
		return;
	}
	
	MongoClient.connect(connectionString, function(err, db) {
		var userId = loggedUsers[userToken];
		var result = [];
		
		db.collection("users").findOne({_id : new ObjectID(userId)}, function(err, user) {
			var idSet = [];
			idSet.push(user._id);
			
			var following = user.following;
			for (var i = 0; i < following.length; i++) {
				idSet.push(following[i]);
			}
			
			var userAndFollowers = {};
			db.collection("users").find({_id: {$in : idSet}}).toArray(function(err, users) {
				for (var i = 0; i < users.length; i++) {
					var user = users[i];
					userAndFollowers[user._id.toString()] = user.username;
				}

				db.collection("posts").find({userId: {$in: idSet}}).toArray(function(err, posts) {
					for (var j = 0; j < posts.length; j++) {
						var post = posts[j];
						
						var item = {
							id: post._id.toString(),
							username: userAndFollowers[post.userId],
							date: post.date,
							title: post.title,
							description: post.description,
							route: post.route,
							pics: post.pics
						};
							
						result.push(item);
					}
				
					res.send({
						success : true,
						posts: result,
						msg : "OK",
					});

					db.close();
				});
			});
		});
	});
});

app.get('/:userToken/post/:postId', function(req, res){
	var userToken = req.params.userToken;
	var postId = req.params.postId;
	
	if (!loggedUsers[userToken]) {
		res.send({                
			success : false, 
			msg: "Invalid user token"
		});
		return;
	}
	
	MongoClient.connect(connectionString, function(err, db) {
			db.collection("posts").findOne({_id : new ObjectID(postId)}, function(err, post) {
				db.collection("users").findOne({_id: post.userId}, function(err, user) {
					var username = user.username;
					var result = 
						{
							username: username,
							date: post.date,
							title: post.title,
							description: post.description
						};
				
					res.send({
						success : true,
						post: result,
						msg : "OK",
					});
				
					db.close();
			});
		});
	});
});

app.use(function error(err, req, res, next) {
  console.error(err.stack);

  res.send(500);
});

if (!module.parent) {
  app.listen(3000);
  console.log('Moto proto server started on port 3000');
}