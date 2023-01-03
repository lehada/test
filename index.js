const express = require("express");
const app = express();
const cors = require('cors');
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
	cors: {
		origin: '*',
	}
});
const { connect, Schema, model } = require('mongoose');

const start = async () => {
    await connect('mongodb+srv://admin:admin@cluster0.ixpg1gx.mongodb.net/?retryWrites=true&w=majority', {
        useNewUrlParser: true,
	    useUnifiedTopology: true
    })
    .then(data => console.log('MongoDB connect!'))
    .catch(err => console.log(`MongoDB connect error - ${err}`));
};

start()

const getUser = async uid => {
    let user = await User.findOne({ uid: uid }).exec();

    return user ? user : new User({
        uid: uid,
    }).save();
};

const UserSchema = new Schema({
    uid: {
        type: Number,
        default: 1
    },
	photo: {
		type: String,
		default: ''
	},
	nick: {
		type: String,
		default: ''
	},
	online: {
		type: Boolean,
		default: false
	},
	bonus: {
		type: Boolean,
		default: true
	},
	video: {
		type: Boolean,
		default: true
	},
	ingame: {
		type: Boolean,
		default: false
	},
	ingamesocket: {
		type: String,
		default: ''
	},
	balance: {
        type: Number,
        default: 0
    },
	top: {
        type: Number,
        default: 0
    },
	bonusTime: {
        type: Number,
        default: getUnix()
    },
	videoTime: {
		type: Number,
		default: getUnix()
	}
});

const User = model('users', UserSchema);

const {
	getUnix,
	getUrlVars,
	validateAppUrl,
	random,
	pick,
	save,
	number_format
} = require("./addons/utils");

app.use(cors());
app.use(express.json());

setInterval(async () => {
	const online = 0;
	let users = await User.find().exec();
	for(let i in users) {
		if(users[i].online === true) online += Number(1);
	};
	io.emit('getOnline', online);

	for (let i in users) {
		const user = await User.findOne({ uid: users[i].uid }).exec();
		if(user) {
			if (getUnix() > user.bonusTime || !user.bonusTime) {
				user.bonus = true;
				user.bonusTime = Number(getUnix() + 14400000);
				await user.save();
			};
			if (getUnix() > user.videoTime || !user.videoTime) {
				user.video = true;
				user.videoTime = Number(getUnix() + 60000);
				await user.save();
			};
		};
	};
}, 7500);

io.on('connection', async function (socket) {
    var params = socket.handshake.query.params;
	var vars = socket.handshake.query;
	if(params) {
		/*
		var prov = validateAppUrl(params, secret_key);
		if (prov.sign != prov.vk) {
			socket.disconnect();
			console.log(`err1`, prov);
			return;
		};
		params = getUrlVars(params);
		if (Number(params.vk_user_id) != Number(vars.uid)) {
			socket.disconnect();
			console.log(`err`);
			return;
		};
		*/
		let user = await new User({
			uid: socket.handshake.query.uid,
			photo: socket.handshake.query.photo,
			nick: socket.handshake.query.nick
		}).save();
		const sendData = setInterval(() => {
			socket.emit('response', {
				"type": "userData",
				"bonus": user.bonus === true ? 1 : 0,
				"balance": user.balance
			});
		}, 7500);
		socket.emit('response', {
			"type": "userData",
			"bonus": user.bonus === true ? 1 : 0,
			"balance": user.balance
		});
		user.online = true;
		await user.save();
		socket.on(`disconnect`, async () => {
			clearInterval(sendData);
			user.online = false;
			user.ingame = false;
			user.ingamesocket = "";
			await user.save();
		});

		socket.on('request', async msg => {
			if (msg.type === 'bonus') {
				let randAmount = random(1, 500);
				if (user.bonus) {
					user.balance += Number(randAmount);
					user.bonus = false;
					await user.save();
				};
				socket.emit(`response`, {
					'type': 'bonusUpdate',
					'balance': user.balance,
					'randAmount': randAmount,
					'bonus': user.bonus === true ? 1 : 0
				});
			};
			if (msg.type === 'watchAds') {
				if (msg.data.result) {
					if(user.video) {
						var randAmount = random(1, 50);
						user.balance += Number(randAmount);
						await user.save();
						socket.emit(`response`, {
							'type': 'successAds',
							'balance': user.balance,
							'amount': randAmount
						});
						return;
					} else {
						socket.emit(`response`, {
							'type': 'errorAds'
						});
						return;
					};
				}
				else {
					socket.emit(`response`, {
						'type': 'errorAds'
					});
					return;
				}
			};
			if(msg.type == 'getTop') {
				let users = await User.find().exec();
				let top = [];
				let resArr = []
				let myResArr = {};
    			let me = 0;
    			for (i in users){
        			top.push({
						id: 0,
            			uid: users[i].uid,
            			nick: users[i].nick,
            			photo: users[i].photo,
						top: users[i].top ? users[i].top : 0,
						me: users[i].uid === Number(socket.handshake.query.uid) ? 1 : 0
        			});
    			};
				top.sort((a, b) => {
					return b.top - a.top;
				});
				top.filter((x, i) => {
					if (i < 50) {
						x.id = i + 1;
						resArr.push(x);
						if (x.uid === Number(socket.handshake.query.uid)) {
							myResArr = x;
							me = 1;
						};
					};
				});
				if (me == 0) {
					top.filter((x, i) => {
						x.id = i + 1;
						if(x.uid == Number(socket.handshake.query.uid)) {
							myResArr = x;
							me = 1;
						};
					});
				};
				socket.emit(`response`, {
					'type': 'topData',
					'array': resArr,
					'my': myResArr
				});
				return;
			};
		});
	};
});

const port = process.env.PORT || 3000;

http.listen(port, () => {
	setInterval(() => {
		console.log("Started " + port);
	}, 5000);
});
