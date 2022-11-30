const jwt = require('jsonwebtoken');
const {User} = require('../models');
require('dotenv').config();

module.exports = async (req, res, next) => {
    const {authorization} = req.headers;
    const [authType, authToken] = (authorization || '').split(' ');
    if (!authToken || authType !== 'Bearer') {
        return res.status(401).send({
            errorMessage: 'Login is required'
        })
    }

    try {
        const {userId} = jwt.verify(authToken, process.env.SECRET_KEY);
        const user = await User.findByPk(userId);
        res.locals.user = user;
        next();
    } catch (error) {
        return res.status(401).send({
            errorMessage: 'You are not logged in'
        })
    }
}