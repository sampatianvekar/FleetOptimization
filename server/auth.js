const jwt=require("jsonwebtoken")

exports.generateToken=(id)=>{
return jwt.sign({id}, "fleet_secret",{expiresIn:"1d"})
}