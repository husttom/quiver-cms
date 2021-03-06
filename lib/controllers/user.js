var	ConfigService = require('../services/config-service'),
	LogService = require('../services/log-service'),
	FirebaseService = require('../services/firebase-service'),
	Firebase = require('firebase'),
	moment = require('moment'),
	firebaseEndpoint = ConfigService.get('public.firebase.endpoint');

module.exports = {
	hydrateUser: function (req, res, next) {
		if (req.method === 'OPTIONS') {
	    	return next();
	  	}

		var userToken = req.headers.authorization,
			uid = req.headers['uid'],
			provider = req.headers['provider'],
			email = req.headers.email,
			usersRef = FirebaseService.getUsers(),
			handleAuthError = function (err) {
			  LogService.log('userRef auth', err);
			  return res.status(401).send({'error': 'Not authorized. uid and authorization headers must be present and valid.'});
			},
			hydrate = function (key) {
				req.userRef = new Firebase(firebaseEndpoint + '/users/' + key);
				req.userRef.authWithCustomToken(userToken, function (err, currentUser) {
					req.userRef.once('value', function (snap) {
						req.user = snap.val();
						next();
					});
				});
			};

		if (!userToken) {
			return res.sendStatus(403);
		}

		FirebaseService.authWithSecret(usersRef).then(function (usersRef) {
			usersRef.orderByChild('email').equalTo(email).once('value', function (snap) {
				var count = snap.numChildren();

				if (count > 1) {
					LogService.log('Multiple users found in hydrateUser', keys);
					handleAuthError('Multiple users found');
				} else if (count === 1) {
					snap.forEach(function (userSnap) {
						var user = userSnap.val();
						if (user[provider] && user[provider] === uid) {
							hydrate(userSnap.key());	
						} else {
							userSnap.ref().child(provider).set(uid, function (err) {
								return err ? handleAuthError(err) : hydrate(userSnap.key())
							});
						}
						
					});
				} else { // Create new user
					FirebaseService.firebaseRoot.authWithCustomToken(userToken, function (err, currentUser) {
						var now = moment(),
							newUserRef = FirebaseService.getUsers().push()
							payload = {
								email: email,
								created: now.format(),
								public: {
									id: newUserRef.key(),
									email: email,
									preferences: {
										marketing: true,
										tracking: true
									}
								},
								private: {
									isAdmin: false,
									isModerator: false
								}
							};

						if (!currentUser) {
							console.log('User auth error. currentUser missing');
							LogService.log('User auth error. currentUser missing');
							return req.sendStatus(500);
						}

						payload[currentUser.provider] = currentUser.uid;

						FirebaseService.authWithSecret(newUserRef).then(function (ref) {
							ref.setWithPriority(payload, now.unix(), function (err) {
								if (err) {
									return handleAuthError(err);
								} else {
									hydrate(ref.key());
								}
							});	
						});	

					});

				}
				
			});
			
		});

	},

	get: function (req, res) {
		var provider = req.params.provider,
			uid = req.params.uid;

		if (req.user[provider] === uid) {
			req.userRef.child('lastLogin').set(moment().format());
			if (!req.user.public.email) {
				req.userRef.child('public').child('email').set(req.headers.email);
			}

			FirebaseService.authWithSecret(FirebaseService.getAcl(uid)).then(function (ref) {
				ref.set({
					isAdmin: req.user.private.isAdmin || false,
					isModerator: req.user.private.isModerator || false,
					userKey: req.userRef.key()
				}, function (err) {
					return err ? LogService.log('ACL error', err) : true;
				});	
			});

	    res.json({user: req.user, key: req.userRef.key()});
	  } else {
	    res.sendStatus(403);
	  }
	}

};