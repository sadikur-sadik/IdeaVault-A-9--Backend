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
      console.log(result);
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
    
    // getting live activity feed
    app.get('/activity-feed', async (req, res) => {
      try {
        const recentIdeas = await ideaDatabase
          .find({})
          .sort({ _id: -1 })
          .limit(5)
          .toArray();

        const recentComments = await commentDatabase
          .find({})
          .sort({ _id: -1 })
          .limit(5)
          .toArray();

        const ideaActivities = recentIdeas.map((idea) => {
          let timeAgo;
          if (idea.createdAt) {
            timeAgo = new Date(idea.createdAt).toISOString();
          } else {
            timeAgo = idea._id.getTimestamp().toISOString();
          }

          return {
            id: idea._id.toString(),
            type: 'idea_created',
            user: idea.userName || 'Anonymous Creator',
            targetTitle: idea.title || 'Untitled Idea',
            targetId: idea._id.toString(),
            timeAgo
          };
        });

        const commentActivities = recentComments.map((comment) => {
          let timeAgo;
          if (comment.timeStamp && comment.timeStamp.year) {
            const t = comment.timeStamp;
            timeAgo = new Date(t.year, t.month - 1, t.date, t.hour, t.minute, t.second || 0).toISOString();
          } else if (comment.createdAt) {
            timeAgo = new Date(comment.createdAt).toISOString();
          } else {
            timeAgo = comment._id.getTimestamp().toISOString();
          }

          return {
            id: comment._id.toString(),
            type: 'comment_added',
            user: comment.userName || 'Anonymous Collaborator',
            targetTitle: comment.ideaTitle || 'Startup Idea',
            targetId: comment.ideaID ? comment.ideaID.toString() : comment._id.toString(),
            timeAgo
          };
        });

        const pollActivities = [];
        recentIdeas.forEach((idea) => {
          if (idea.poll && Array.isArray(idea.poll.options)) {
            const totalVotes = idea.poll.options.reduce((sum, opt) => sum + (opt.votes ? opt.votes.length : 0), 0);
            if (totalVotes > 0) {
              let pollTime = idea.poll.createdAt
                ? new Date(idea.poll.createdAt).toISOString()
                : (idea.createdAt ? new Date(idea.createdAt).toISOString() : idea._id.getTimestamp().toISOString());
              pollActivities.push({
                id: `poll-${idea._id.toString()}`,
                type: 'poll_voted',
                user: 'Community Member',
                targetTitle: idea.title || 'Startup Idea',
                targetId: idea._id.toString(),
                timeAgo: pollTime
              });
            }
          }
        });

        const combined = [...ideaActivities, ...commentActivities, ...pollActivities];
        combined.sort((a, b) => new Date(b.timeAgo) - new Date(a.timeAgo));
        const activities = combined.slice(0, 10);

        res.send(activities);
      } catch (err) {
        console.error("Error fetching activity feed:", err);
        res.status(500).json({ error: "Failed to fetch activity feed" });
      }
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

    // Voting in a poll
    app.post('/ideas/:id/poll/vote', verifyJWTToken, async (req, res) => {
      try {
        const id = req.params.id;
        const { optionId } = req.body;
        const userId = req.user?.id || req.user?.sub || req.user?.userId;

        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const idea = await ideaDatabase.findOne({ _id: new ObjectId(id) });
        if (!idea || !idea.poll) {
          return res.status(404).json({ error: "Idea or poll not found" });
        }

        const updatedOptions = (idea.poll.options || []).map((opt) => {
          const filteredVotes = (opt.votes || []).filter((vId) => vId !== userId);
          if (opt.id === optionId) {
            filteredVotes.push(userId);
          }
          return {
            ...opt,
            votes: filteredVotes,
          };
        });

        const updatedPoll = {
          ...idea.poll,
          options: updatedOptions,
        };

        await ideaDatabase.updateOne(
          { _id: new ObjectId(id) },
          { $set: { poll: updatedPoll } }
        );

        res.send({ success: true, poll: updatedPoll });
      } catch (err) {
        res.status(500).json({ error: "Failed to process vote" });
      }
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