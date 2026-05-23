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
async function run () {
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


    // getting api of ideas

    app.get('/ideas',async(req,res ) =>{
      
      const cursor = ideaDatabase.find();
      
      const result = await cursor.toArray()
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