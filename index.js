const express = require("express");
const app = express();

const data = require("./MOCK_DATA.json");

app.get("/api/users", (req, res) => {
    res.json(data);
});

app.get("/users", (req, res) => {
    const html = `
    <ul>
    ${data.map(user => `<li>${user.first_name}</li>`).join("")}
    </ul>
    `;

    res.send(html);
});

//rest api


app.get("/api/users", (req, res) => {
    res.json(data);
});

app.get("/api/users/:id",(req, res) =>{;
const id =number (req.pramas.id);
const users =users.find((user) => user.id=== id);{
    return res.json(user);

};

});

app.post("/api/users", (req, res) => {
   return  res.json({status:"pending"});
});

app.patch("/api/users:id", (req, res) => {
    //edit the user with id
   return  res.json({status:"pending"});
});



app.delete("/api/users:id", (req, res) => {
    //delete the user with id
   return  res.json({status:"pending"});
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});