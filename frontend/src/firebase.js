import { initializeApp, database } from 'firebase';

const config = require('./firebase.private.config.json');

initializeApp(config);

const TopImages = database().ref('top_images');
// const Articles = database().ref('articles');
const Articles = database().ref('articles_lite');

export function getArticles(maxItems, callback) {
  const limit = maxItems || 10;
  // Articles.orderByValue().limitToLast(limit).on('value', (dataSnapshot) => {
  // Articles.orderByChild('expanded_url').limitToLast(limit).on('value', (dataSnapshot) => {
  Articles.orderByKey().limitToLast(limit).once('value', (dataSnapshot) => {
    const articles = dataSnapshot.val();
    // console.log(articles);
    callback(null, articles);
  // }).catch((error) => {
  //   console.error(error);
  //   callback(error, null);
  });// Articles....()
}// getArticles

export function getTopImages(maxItems, callback) {
  const limit = maxItems || 10;
  TopImages.limitToLast(limit).on('value', (dataSnapshot) => {
    const topImages = dataSnapshot.val();
    callback(null, topImages);
  // }).catch((error) => {
  //   console.error(error);
  //   callback(error, null);
  });// TopImages
}// getTopImages

export function getArticle(tweetId, callback) {
  return Articles.child(tweetId).orderByChild('expanded_url').on('child_added', (dataSnapshot) => {
    const article = dataSnapshot.val();
    // console.log(article);
    callback(null, article);
  // }).catch((error) => {
  //   console.error(error);
  //   callback(error, null);
  });// Articles.child
}// getArticles
