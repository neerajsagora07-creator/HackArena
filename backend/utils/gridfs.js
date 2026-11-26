const mongoose = require("mongoose");

function getGridFSBucket() {
    if (mongoose.connection.readyState !== 1) {
        throw new Error("MongoDB is not connected.");
    }

    return new mongoose.mongo.GridFSBucket(
        mongoose.connection.db,
        {
            bucketName: "presentations"
        }
    );
}

module.exports = getGridFSBucket;