const express = require('express')
const app = express()
const envConfig = require('dotenv')
envConfig.config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000
const cors = require('cors');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
)


app.use(express.json())
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));


const uri = process.env.MONGO_URI

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


const verifyJWTToken = async (req, res, next) => {
 
  const JWTHeader = req?.headers?.authorization;
  
  if (!JWTHeader) {
    return res.status(401).json({ message: "Unauthorized access" });
  }
  const token = JWTHeader.split(" ")[1];
  console.log(token);

  if (!token) {
    return res.status(401).json({ message: "Unauthorized access" });
  }
  try {
    const { payload } = await jwtVerify(token, JWKS);

    req.user = payload;
    next();
  }
  catch (error) {
    return res.status(403).json({ message: "forbidden" })
  }
}
async function run() {
  try {

    // await client.connect();

    // await client.db("admin").command({ ping: 1 });
    const db = client.db("idea-vault-database")
    const ideaDatabase = db.collection("ideas")
    const commentDatabase = db.collection("comments")

    // posting data

    app.post('/ideas', verifyJWTToken, async (req, res) => {
      const newUser = req.body;
      const result = await ideaDatabase.insertOne(newUser);
      res.send(result);
    });

    // posting comment
    app.post('/comments',verifyJWTToken, async (req, res) => {
      const comment = req.body;
      const result = await commentDatabase.insertOne(comment);
      res.send(result);
    });

    // getting api of ideas

    app.get('/ideas', async (req, res) => {
      const { search, filter } = req.query;
      const query = {};

      if (search) {
        query.title = { $regex: search, $options: 'i' };
      }

      if (filter) {
        query.category = filter;
      }

      const cursor = ideaDatabase.find(query);
      const result = await cursor.toArray();

      res.send(result);
    });
    
    app.get('/feturedideas', async (req, res) => {

      const cursor = ideaDatabase.find().limit(6);

      const result = await cursor.toArray()
      res.send(result)
    })



    // getting api with id

    app.get('/ideas/:id',verifyJWTToken, async (req, res) => {

      const id = req.params.id;

      const query = { _id: new ObjectId(id) };

      const result = await ideaDatabase.findOne(query);

      res.send(result)
    })




    // getting api of comments
    app.get('/comments',verifyJWTToken,async (req, res) => {

      const cursor = commentDatabase.find();

      const result = await cursor.toArray()
      res.send(result)
    })


    app.delete('/ideas/:id', verifyJWTToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await ideaDatabase.deleteOne(query);
      res.send(result);
    })


    app.delete('/comments/:id', verifyJWTToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await commentDatabase.deleteOne(query);
      res.send(result);
    })


    app.patch('/ideas/:id', verifyJWTToken, async (req, res) => {

      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const update = req.body
      const updatedIdea = {
        $set: update
      }
      const result = await ideaDatabase.updateOne(query, updatedIdea)
      res.send(result)
    })

    app.patch('/comments/:id',verifyJWTToken, async (req, res) => {

      const id = req.params.id;

      const query = { _id: new ObjectId(id) };

      const update = req.body;

      const updatedComment = {
        $set: update
      }

      const result = await commentDatabase.updateOne(query, updatedComment)
      res.send(result)
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