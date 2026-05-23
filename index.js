const express = require('express')
const app = express()
const envConfig = require('dotenv')
envConfig.config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000
const cors = require('cors');



app.use(express.json())
app.use(cors());


const uri = process.env.MONGO_URI

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {

    await client.connect();

    await client.db("admin").command({ ping: 1 });
    const db = client.db("idea-vault-database")
    const ideaDatabase = db.collection("ideas")
    const commentDatabase = db.collection("comments")

    // posting data

    app.post('/ideas', async (req, res) => {
      const newUser = req.body;

      const result = await ideaDatabase.insertOne(newUser);
      res.send(result);
    });

    // posting comment
    app.post('/comments', async (req, res) => {
      const comment = req.body;
      const result = await commentDatabase.insertOne(comment);
      res.send(result);
    });

    // getting api of ideas

    app.get('/ideas', async (req, res) => {

      const cursor = ideaDatabase.find();

      const result = await cursor.toArray()
      res.send(result)
    })



    // getting api with id

    app.get('/ideas/:id', async (req, res) => {

      const id = req.params.id;

      const query = { _id: new ObjectId(id) };

      const result = await ideaDatabase.findOne();

      res.send(result)
    })




    // getting api of comments
    app.get('/comments', async (req, res) => {

      const cursor = commentDatabase.find();

      const result = await cursor.toArray()
      res.send(result)
    })


    app.delete('/ideas/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await ideaDatabase.deleteOne(query);
      res.send(result);
    })


  } finally {

    // await client.close();
  }
}
run().catch(console.dir);
app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})