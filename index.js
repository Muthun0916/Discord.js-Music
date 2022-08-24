const {
  entersState,
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  VoiceConnectionStatus,
  AudioPlayerStatus
} = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const yts = require('yt-search');
const eventEmitter = require('events');
const activeSongs = new Map();
const event = new eventEmitter();
let isValiableURL = false;

module.exports.event = event;

exports.play = async (options = {}) => {

  const {
    interaction,
    channel,
    song,
    show
  } = options;
  if (!channel || channel?.type !== 'GUILD_VOICE') throw new Error(`INVALID_VOICE_CHANNEL: There is no valid VoiceChannel provided.`);
  if (!song || typeof song !== 'string') throw new Error(`INVALID_MUSIC_URL: There is no valid Music URL provided.`);
  if (!interaction) throw new Error(`INVALID_INTERACTION: There is no valid CommandInteraction provided.`)

  if (!ytdl.validateURL(song)) {
    interaction.reply(`${song}は処理できません。`);
    console.log("URL IS INAVAILABLE!!")
  } else {
    isValiableURL = true;
    console.log("URL IS AVAILABLE!!")
  }
  const data = activeSongs.get(channel.guild.id) || {};

  if (!channel.guild.me.voice.channel) {
    data.connection = await connectToChannel(channel);
  };
  if (!data.connection) {
    data.connection = await connectToChannel(channel);
  };

  if (!data.queue) data.queue = [];
  if (!data.repeat) data.repeat = false;


  data.guildId = channel.guild.id;

  let queueSongInfo;

  const ytdlSongInfo = await ytdl.getInfo(song);


  console.log(ytdlSongInfo["videoDetails"]);

  queueSongInfo = {
    title: ytdlSongInfo["videoDetails"]["title"],
    author: ytdlSongInfo["videoDetails"]["author"],
    duration: ytdlSongInfo["videoDetails"]["lengthSeconds"],
    url: song,
    thumbnail: ytdlSongInfo["videoDetails"]["thumbnails"].slice(-1)[0]["url"],
    extra: {
      type: 'video',
      playlist: null
    }
  };

  await data.queue.push({
    info: queueSongInfo,
    requester: interaction.user,
    url: song,
    channel: interaction.channel
  });

  if (!data.dispatcher && isValiableURL) {

    playSong(data, interaction);
    console.log(show)
    if (show) await interaction.channel.send(`これ再生するよ ${song} `);

  } else {

    if (queueSongInfo.extra.type === 'playlist') {
      event.emit('addList', interaction.channel, queueSongInfo.extra.playlist, interaction.user);
    } else {
      event.emit('addSong', interaction.channel, queueSongInfo, interaction.user);
    }

  };

  activeSongs.set(channel.guild.id, data);

};

exports.isConnected = async (options = {}) => {

  const {
    interaction
  } = options;
  if (!interaction) throw new Error(`INVALID_INTERACTION: There is no valid CommandInteraction provided.`)

  const fetchedData = activeSongs.get(interaction.guild.id);

  if (!fetchedData?.connection && !fetchedData?.player) return Boolean(false)
  else return Boolean(true)

};

exports.stop = async (options = {}) => {

  const {
    interaction
  } = options;
  if (!interaction) throw new Error(`INVALID_INTERACTION: There is no valid CommandInteraction provided.`)

  if (!activeSongs.has(interaction.guild.id) || !activeSongs.get(interaction.guild.id)?.connection || !activeSongs.get(interaction.guild.id)?.player) return interaction.channel.send("再生する音楽がないよ");

  const fetchedData = await activeSongs.get(interaction.guild.id);

  fetchedData.player.stop();
  fetchedData.connection.destroy();
  activeSongs.delete(interaction.guild.id);

};

exports.repeat = async (options = {}) => {

  const {
    interaction,
    value
  } = options;
  if (!interaction) throw new Error(`INVALID_INTERACTION: There is no valid CommandInteraction provided.`);
  if (!value) value === false;
  if (value === undefined || typeof value !== 'boolean') throw new Error(`INVALID_BOOLEAN: There is no valid Boolean provided.`);

  if (!activeSongs.has(interaction.guild.id) || !activeSongs.get(interaction.guild.id)?.connection || !activeSongs.get(interaction.guild.id)?.player) return interaction.channel.send("再生する音楽がないよ");;

  const fetchedData = await activeSongs.get(interaction.guild.id);

  if (fetchedData?.repeat === value) return interaction.channel.send("すでにリピートするようになってるよ");

  fetchedData.repeat = value;
  activeSongs.set(interaction.guild.id, fetchedData);

}

exports.isRepeated = async (options = {}) => {

  const {
    interaction
  } = options;
  if (!interaction) throw new Error(`INVALID_INTERACTION: There is no valid CommandInteraction provided.`)

  if (!activeSongs.has(interaction.guild.id) || !activeSongs.get(interaction.guild.id)?.connection || !activeSongs.get(interaction.guild.id)?.player) return interaction.channel.send("再生する音楽がないよ");

  const fetchedData = activeSongs.get(interaction.guild.id);

  return Boolean(fetchedData.repeat);

}

exports.skip = async (options = {}) => {

  const {
    interaction
  } = options;
  if (!interaction) throw new Error(`INVALID_INTERACTION: There is no valid CommandInteraction provided.`)

  if (!activeSongs.has(interaction.guild.id) || !activeSongs.get(interaction.guild.id)?.connection || !activeSongs.get(interaction.guild.id)?.player) return interaction.channel.send("再生する音楽がないよ");

  const fetchedData = await activeSongs.get(interaction.guild.id);
  const player = await fetchedData.player;
  const connection = await fetchedData.connection

  const finishChannel = await fetchedData.queue[0].channel
  await fetchedData.queue.shift();

  if (fetchedData.queue.length > 0) {

    activeSongs.set(interaction.guild.id, fetchedData);

    playSong(fetchedData, interaction)

  } else {

    await event.emit('finish', finishChannel);
    await activeSongs.delete(interaction.guild.id);

    await player.stop();
    await connection.destroy();

  };

};

exports.pause = async (options = {}) => {

  const {
    interaction
  } = options;
  if (!interaction) throw new Error(`INVALID_INTERACTION: There is no valid CommandInteraction provided.`)

  if (!activeSongs.has(interaction.guild.id) || !activeSongs.get(interaction.guild.id)?.connection || !activeSongs.get(interaction.guild.id)?.player) return interaction.channel.send("再生する音楽がないよ");

  const fetchedData = activeSongs.get(interaction.guild.id);
  const player = fetchedData.player;

  if (player.state.status === 'paused') return interaction.channel.send("すでに停止しているよ");

  player.pause();

}

exports.isPaused = async (options = {}) => {

  const {
    interaction
  } = options;
  if (!interaction) throw new Error(`INVALID_INTERACTION: There is no valid CommandInteraction provided.`)

  if (!activeSongs.has(interaction.guild.id) || !activeSongs.get(interaction.guild.id)?.connection || !activeSongs.get(interaction.guild.id)?.player) return interaction.channel.send("再生する音楽がないよ");

  const fetchedData = activeSongs.get(interaction.guild.id);
  const player = fetchedData.player;

  if (player.state.status === 'paused') return Boolean(true)
  else return Boolean(false)

}

exports.resume = async (options = {}) => {

  const {
    interaction
  } = options;
  if (!interaction) throw new Error(`INVALID_INTERACTION: There is no valid CommandInteraction provided.`)

  if (!activeSongs.has(interaction.guild.id) || !activeSongs.get(interaction.guild.id)?.connection || !activeSongs.get(interaction.guild.id)?.player) return interaction.channel.send("再生する音楽がないよ");
  const fetchedData = activeSongs.get(interaction.guild.id);
  const player = fetchedData.player;

  if (player.state.status === 'playing') return interaction.channel.send("すでに再生されてるよ");

  player.unpause();

}

exports.isResumed = async (options = {}) => {

  const {
    interaction
  } = options;
  if (!interaction) throw new Error(`INVALID_INTERACTION: There is no valid CommandInteraction provided.`)

  if (!activeSongs.has(interaction.guild.id) || !activeSongs.get(interaction.guild.id)?.connection || !activeSongs.get(interaction.guild.id)?.player) return interaction.channel.send("再生する音楽がないよ");

  const fetchedData = activeSongs.get(interaction.guild.id);
  const player = fetchedData.player;

  if (player.state.status === 'playing') return Boolean(true)
  else return Boolean(false)

}

exports.jump = async (options = {}) => {

  const {
    interaction,
    number
  } = options
  if (!interaction) throw new Error(`INVALID_INTERACTION: There is no valid CommandInteraction provided.`);
  if (!number || !Number.isInteger(number)) return interaction.channel.send("数字を入力してね");

  if (!activeSongs.has(interaction.guild.id) || !activeSongs.get(interaction.guild.id)?.connection || !activeSongs.get(interaction.guild.id)?.player) return interaction.channel.send("再生する音楽がないよ");

  const fetchedData = await activeSongs.get(interaction.guild.id);

  if (number > fetchedData.queue.length) return interaction.channel.send("もうすこし小さな数字を入力してね");

  await fetchedData.queue.splice(0, number);
  activeSongs.set(interaction.guild.id, fetchedData);

  playSong(activeSongs.get(interaction.guild.id), interaction);

}

exports.getQueue = async (options = {}) => {

  const {
    interaction
  } = options
  if (!interaction) throw new Error(`INVALID_INTERACTION: There is no valid CommandInteraction provided.`);
  if (!activeSongs.has(interaction.guild.id) || !activeSongs.get(interaction.guild.id)?.connection || !activeSongs.get(interaction.guild.id)?.player) return interaction.channel.send("再生する音楽がないよ");

  const fetchedData = await activeSongs.get(interaction.guild.id);

  return (fetchedData.queue);

};

exports.removeQueue = async (options = {}) => {

  const {
    interaction,
    number
  } = options;
  if (!interaction) throw new Error(`INVALID_INTERACTION: There is no valid CommandInteraction provided.`);
  if (!number || !Number.isInteger(number)) return interaction.channel.send("数字を入力してね");

  if (!activeSongs.has(interaction.guild.id) || !activeSongs.get(interaction.guild.id)?.connection || !activeSongs.get(interaction.guild.id)?.player) return interaction.channel.send("再生する音楽がないよ");

  const fetchedData = await activeSongs.get(interaction.guild.id);
  if (fetchedData.queue.length < number) return interaction.channel.send("もうすこし小さな数字を入力してね");

  const spliceNumber = number - 1;
  fetchedData.queue.splice(spliceNumber, 1);

};

exports.volume = async (options = {}) => {

  const {
    interaction,
    volume
  } = options;
  if (!interaction) throw new Error(`INVALID_INTERACTION: There is no valid CommandInteraction provided.`);
  if (!volume || !Number.isInteger(volume) || volume > 100) throw new Error(`INVALID_VOLUME: There is no valid Volume Integer provided or the number is higher than 100.`);
  if (!activeSongs.has(interaction.guild.id) || !activeSongs.get(interaction.guild.id)?.connection || !activeSongs.get(interaction.guild.id)?.player) return interaction.channel.send("再生する音楽がないよ");

  const fetchedData = await activeSongs.get(interaction.guild.id);

  fetchedData.resource.volume.setVolume(volume)

};

async function playSong(data, interaction) {

  let resource = await createAudioResource(ytdl(data.queue[0].url, {
    filter: 'audioonly',
    highWaterMark: 32 * 1024 * 1024,
  }), {
    inputType: StreamType.Arbitrary,
    inlineVolume: true,
  });

  const player = createAudioPlayer();

  player.play(resource);

  data.player = player;
  data.resource = resource
  data.dispatcher = await data.connection.subscribe(player);
  data.dispatcher.guildId = data.guildId;

  if (data.queue[0].info.extra.type === 'playlist') {
    event.emit('playList', data.queue[0].channel, data.queue[0].info.extra.playlist, data.queue[0].info, data.queue[0].requester);
  } else {
    event.emit('playSong', data.queue[0].channel, data.queue[0].info, data.queue[0].requester);
  }

  await entersState(player, AudioPlayerStatus.Playing, 10 * 1000);
  await entersState(player, AudioPlayerStatus.Idle, 24 * 60 * 60 * 1000);
  finishedSong(player, data.connection, data.dispatcher, interaction);

  player.on('error', err => console.log(err))

};

async function finishedSong(player, connection, dispatcher, interaction) {

  const fetchedData = await activeSongs.get(dispatcher.guildId);

  if (fetchedData?.repeat === true) return playSong(fetchedData, interaction)

  await fetchedData.queue.shift();

  if (fetchedData.queue.length > 0) {

    activeSongs.set(dispatcher.guildId, fetchedData);

    playSong(fetchedData, interaction)

  } else {

    event.emit('finish', interaction.channel);

    activeSongs.delete(dispatcher.guildId);

    player.stop();
    connection.destroy();

  };

};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

async function connectToChannel(channel) {
  return new Promise(async (resolve, reject) => {
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false
    });
    connection.once(VoiceConnectionStatus.Ready, () => {
      resolve(connection)
    })
    await delay(30000)
    reject('Connection was failed to connect to VC')
  })
}
