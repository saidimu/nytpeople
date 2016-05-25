var fetch = require('node-fetch');

import {
  init_writer,
  init_reader,
  publish as publish_message
} from './messaging.js';


import {
  Tweet,
  Urls,
  TopImage
} from './datastore.js';

init_writer();

const host = process.env.NEWSPAPER_PORT_8000_TCP_ADDR;
const port = process.env.NEWSPAPER_PORT_8000_TCP_PORT;

const endpoint = `http://${host}:${port}/top_image`;
// const endpoint = `${host}/top_image`;

export function process_tweets() {
  init_reader(
    process.env.TWEETS_TOPIC,
    process.env.TWEETS_PROCESS_CHANNEL,
    {
      message: on_tweet,
      discard: on_discard_message
    }
  );// init_reader

  function on_tweet(message)  {
    const tweet = message.json();
    const tweet_id = tweet.id_str;
    tweet.entities.urls.forEach((url) => {
      if(url) {
        // console.log('Publishing message: %s', JSON.stringify(url));
        publish_message(process.env.TWEET_URLS_TOPIC, {
          tweet_id: tweet_id,
          url: url
        });// publish_message
      }// if
    });// forEach

    message.finish();
  }// on_tweet
}// process_tweets

export function save_tweets() {
  init_reader(
    process.env.TWEETS_TOPIC,
    process.env.TWEETS_SAVE_CHANNEL,
    {
      message: on_tweet,
      discard: on_discard_message
    }
  );// init_reader

  function on_tweet(message)  {
    // console.log(message.id);
    const tweet = message.json();
    const tweet_id = tweet.id_str;
    return Tweet.create({
      tweet_id: tweet_id,
      tweet: tweet
    }).then(function(tweet) {
      console.log('Tweet saved!');
      message.finish();
    }).catch(function(err)  {
      console.error(err);
      message.requeue(null, false); // https://github.com/dudleycarr/nsqjs#new-readertopic-channel-options
    });// Tweet.create
  }// on_tweet
}// save_tweets

export function process_urls() {
  init_reader(
    process.env.TWEET_URLS_TOPIC,
    process.env.TWEET_URLS_PROCESS_CHANNEL,
    {
      message: on_url,
      discard: on_discard_message
    }
  );// init_reader

  function on_url(message)  {
    const url_object = message.json();
    const tweet_id = url_object.tweet_id;
    // console.log('Received message [%s]: %s', message.id, JSON.stringify(url));

    get_top_image(url_object)
      .then(function(top_image)  {
        console.log(top_image);
        if(top_image) {
          const top_image_message = {
            tweet_id: tweet_id,
            top_image: top_image
          };// top_image_message
          console.log('Publishing message: %s', JSON.stringify(top_image_message));
          publish_message(process.env.TOPIMAGE_TOPIC, top_image_message);
          message.finish();
        } else {
          message.requeue(null, false);
        }// if-else
      }).catch(function(err)  {
        console.error(err);
        message.requeue(null, false);
      });// get_top_image
  }// on_url
}// process_urls

export function save_urls() {
  init_reader(
    process.env.TWEET_URLS_TOPIC,
    process.env.TWEET_URLS_SAVE_CHANNEL,
    {
      message: on_url,
      discard: on_discard_message
    }
  );// init_reader

  function on_url(message)  {
    const message_object = message.json();
    const tweet_id = message_object.tweet_id;
    const url = message_object.url || {}; // FIXME TODO check for empty url object

    return Urls
      .child(tweet_id)
      .push(url)
      .then(function(err) {
        if(!err)  {
          console.log('Tweet URL object saved!');
          message.finish();
        } else {
          throw err;
        }//if-else
      }).catch(function(err)  {
        console.error(err);
        message.requeue(null, false); // https://github.com/dudleycarr/nsqjs#new-readertopic-channel-options
      });// Urls.child
  }// on_url
}// save_urls

export function process_top_image() {
  init_reader(
    process.env.TOPIMAGE_TOPIC,
    process.env.TOPIMAGE_PROCESS_CHANNEL,
    {
      message: on_top_image,
      discard: on_discard_message
    }
  );// init_reader

  function on_top_image(message)  {
    console.log(message.id);
  }// on_top_image
}// process_top_image

export function save_top_image() {
  init_reader(
    process.env.TOPIMAGE_TOPIC,
    process.env.TOPIMAGE_SAVE_CHANNEL,
    {
      message: on_top_image,
      discard: on_discard_message
    }
  );// init_reader

  function on_top_image(message)  {
    const top_image_object = message.json();
    const tweet_id = top_image_object.tweet_id;
    const top_image = top_image_object.top_image;

    return TopImage.create({
      top_image: top_image
    }).then(function(top_image) {
      console.log('TopImage URL saved!');

      // Find a related Urls object and associate with newly-created TopImage object
      Urls.findOne({
        attributes: ['tweet_id'],
        where: {
          tweet_id: tweet_id
        }
      }).then(function(urls_object) {
        // associate newly-created Urls object with a Tweet object
        urls_object.setTopimage(top_image).then(function() {
          console.log(
            'Associated Urls["%s"] with TopImage["%s"]',
            urls_object.get('tweet_id'), top_image.get('tweet_id')
          );// console.log

          message.finish();

        }).catch(function(err)  {
          console.error(err);
          console.error(
            'ERROR associating Urls["%s"] with TopImage["%s"]',
            urls_object.get('tweet_id'), top_image.get('tweet_id')
          );// console.error
        });// url_object.addTopImage
      }).catch(function(err)  {
        console.error(err);
      });// Urls.findOne

    }).catch(function(err)  {
      console.error(err);
      message.requeue(null, false); // https://github.com/dudleycarr/nsqjs#new-readertopic-channel-options
    });// TopImage.create
  }// on_url
}// save_top_image

function on_discard_message(message)  {
  // FIXME TODO publish to a 'special' error topic?
  console.error('Received Message DISCARD event.');
  console.error(message);
}// on_discard_message

function get_top_image(url_object)  {
  try {
    const url = url_object.url; // FIXME TODO HACK
    if(url) {
      return fetch(`${endpoint}?url=${url}`)
        .then(function(response)  {
          return response.text();
        }).then(function(body)  {
          const top_image = body;
          // console.log(top_image);
          return top_image;
        });// fetch
    } else {
      console.error('No valid url foumd in URL object: %s', JSON.stringify(url_object));
      return null;
    }// if-else
  } catch (e) {
    console.error(e);
    return null;
  }// try-catch
}// get_top_image
