import "dotenv/config";
console.log("CWD:", process.cwd());
console.log("MONGO_URI:", process.env.MONGO_URI ? "Defined" : "Undefined");
console.log("Test complete");
