import express from "express";
import {createServer} from "node:http";
//import {Server} from "socket.io";
import { connectToSocket } from "./src/controlers/socketManager.js";
import mongoose from "mongoose";
import cors from "cors"; 
import userRoutes from "./src/routes/user_routes.js";
import { config } from 'dotenv'

config();

const app = express(); 
const server = createServer(app);
const io = connectToSocket(server); 

app.set("port", (process.env.PORT || 8000));
app.use(cors()); 
app.use(express.json({limit:"40kb"}));
app.use(express.urlencoded({limit : "40kb", extended:true}));

app.use("/api/v1/users", userRoutes);





app.get("/home", (req, res)=>{
    return res.json({"Hello" : "world"}); 
})

const start = async()=>{
    app.set("mongo_user")
    const connectionDb = await mongoose.connect(process.env.MONGODB_URL);
    console.log(`Mongo Connected DB HOST : ${connectionDb.connection.host}`);
    server.listen(app.get("port"), ()=>{
        console.log("Listen on port 8000");
    })
}

start(); 



