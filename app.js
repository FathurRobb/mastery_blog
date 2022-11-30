const express = require("express");
const jwt = require("jsonwebtoken");
const { User, Post, Comment, Like } = require('./models');
const Joi = require("joi");
const { Op } = require("sequelize");
const autoMiddleware = require("./middlewares/auto-middleware");
require('dotenv').config();

const app = express();
app.use(express.json());
const router = express.Router();

const postUsersSchema = Joi.object({
    nickname: Joi.string().required(),
    password: Joi.string().required(),
    confirmPassword: Joi.string().required(),
  });
  
router.post("/signup", async (req, res) => {
    try {
        const { 
            nickname, 
            password, 
            confirmPassword 
        } = await postUsersSchema.validateAsync(req.body);
        
        if (req.headers.authorization) {
            res.status(400).send({
                errorMessage: "You are already logged in",
            });
            return;
        }

        if (nickname.length < 3 || nickname.match(/[A-Z]/) === null || nickname.match(/[a-z]/) === null || nickname.match(/\d+/g) === null) {
            res.status(400).send({
                errorMessage: "Nickname must consist of at least 3 letters, uppercase and lowercase letters (a~z, A~Z), and numbers (0~9)",
            });
            return;
        }

        if (password.length < 4 || password === nickname) {
            res.status(400).send({
                result: "Registration Failure",
                errorMessage: "Password must be at least 4 characters long, and cannot same as the nickname",
            });
            return;
        }

        if (password !== confirmPassword) {
            res.status(400).send({
                errorMessage: "Password is not the same as password checkbox",    
            });
            return;
        }
        
        const existsUsers = await User.findAll({
            where: {
            [Op.or]: [{ nickname }],
            }
        });

        if (existsUsers.length) {
            res.status(400).send({
            errorMessage: "This is a duplicate nickname",
            });
            return;
        }
        
        await User.create({ nickname, password });
        
        res.status(201).send({});
    } catch (error) {
        console.log(error);
        res.status(400).send({
            errorMessage: 'the request data is not valid'
        })
    }
});

const postAuthSchema = Joi.object({
    nickname: Joi.string().required(),
    password: Joi.string().required(),
})

router.post("/login", async (req, res) => {
    try {
        const { 
            nickname, 
            password 
        } = await postAuthSchema.validateAsync(req.body);

        const user = await User.findOne({ 
            where: {
                nickname
            }
        });

        if (req.headers.authorization) {
            res.status(400).send({
                errorMessage: "You are already logged in",
            });
            return;
        }

        if (!user || password !== user.password) {
            res.status(400).send({
                errorMessage: "Please check your nickname or password",
            });
            return;
        }
        
        const token = jwt.sign({ userId: user.userId }, process.env.SECRET_KEY);
        res.send({
            token,
        });  
    } catch (error) {
        console.log(error);
        res.status(400).send({
            errorMessage: 'the request data is not valid'
        })
    }
});

router.post("/posts", autoMiddleware, async (req, res) => {
    const {userId} = res.locals.user;
    const {title, content} = req.body;
    await Post.create({
        userId,
        title,
        content,
    });
    return res.json({
        message: "You have successfully posted.",
    });
});

router.get("/posts", async (req, res) => {
    const posts = await Post.findAll({
        order: [['createdAt', 'DESC']],
        include: ['user','like']
    });
    // console.log(posts)
    const data = posts.map(p => ({
        postId: p.postId,
        userId: p.userId,
        nickname: p.user.nickname,
        title: p.title, 
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        likes: p.like.length
    }))

    res.json({
        data: data
    })
});

router.get("/posts/:postId", async (req, res) => {
    const { postId } = req.params;
    const post = await Post.findByPk(postId, {include: ['user','like']})
    if (post) {
        const data = {
            postId: post.postId,
            userId: post.userId,
            nickname: post.user.nickname,
            title: post.title,
            content: post.content,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
            likes: post.like.length
        }
        res.send({
            data: data
        })
    } else {
        return res.status(404).json({
            message: "Post not found",
        });
    }
});

router.put("/posts/:postId", autoMiddleware, async (req, res) => {
    const { userId } = res.locals.user;
    const { postId } = req.params;
    const { title, content } = req.body;

    const existsPost = await Post.findOne({
        where: {
            userId,
            postId,
        },
    });
    if (existsPost) {
        existsPost.title = title;
        existsPost.content = content;
        await existsPost.save();
        return res.json({
            message: "Your post has been edited.",
        });
    } else {
        return res.status(404).json({
            message: "Post not found or this is not your post",
        });
    }
});

router.delete("/posts/:postId", autoMiddleware, async (req, res) => {
    const { userId } = res.locals.user;
    const { postId } = req.params;

    const existsPost = await Post.findOne({
        where: {
            userId,
            postId,
        },
    });

    if (existsPost) {
        await existsPost.destroy();
        return res.json({
            message: "Your post has been removed.",
        });
    } else {
        return res.status(404).json({
            message: "Post not found or this is not your post",
        });
    }
});

router.post("/comments/:postId", autoMiddleware, async (req, res) => {
    const { userId } = res.locals.user;
    const { postId } = req.params;
    const { comment } = req.body;

    // if (req.headers.authorization === null) {
    //     res.status(400).send({
    //         errorMessage: "This feature requires a login.",
    //     });
    //     return;
    // }

    const existsPost = await Post.findOne({
        where: {
            postId,
        },
    });


    if (existsPost) {
        if (comment) {
            await Comment.create({
                postId,
                userId,
                comment,
            });
            return res.json({
                message: "You have written a comment",
            });
        } else {
            return res.status(400).send({
                errorMessage: "Please enter the comment content",
            });
        }
    } else {
        return res.status(404).json({
            message: "Post not found",
        });
    }
});

router.get("/comments/:postId", async (req, res) => {
    const { postId } = req.params;
    
    const existsPost = await Post.findOne({
        where: {
            postId,
        },
    });

    if (existsPost) {
        const comments = await Comment.findAll({
            where: {
                postId,
            },
            order: [['createdAt', 'DESC']],
            include: 'user'
        });

        if (comments) {
            const data = comments.map(c => ({
                commentId: c.commentId,
                userId: c.userId,
                nickname: c.user.nickname,
                comment: c.comment, 
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
            }))
        
            res.json({
                data: data
            })            
            return;
        } else {
            res.json({
                data: "This post has no comments yet"
            })            
            return;
        }

    } else {
        return res.status(404).json({
            message: "Post not found",
        });
    }
});

router.put("/comments/:commentId", autoMiddleware, async (req, res) => {
    const { userId } = res.locals.user;
    const { commentId } = req.params;
    const { comment } = req.body;

    const existsComment = await Comment.findOne({
        where: {
            userId,
            commentId,
        },
    });
    if (existsComment) {
        if (comment) {
            existsComment.comment = comment;
            await existsComment.save();
            return res.json({
                message: "Your comment has been edited.",
            });
        } else {
            return res.status(400).send({
                errorMessage: "Please enter the comment content",
            });
        }
    } else {
        return res.status(404).json({
            message: "Comment not found or this is not your comment",
        });
    }
});

router.delete("/comments/:commentId", autoMiddleware, async (req, res) => {
    const { userId } = res.locals.user;
    const { commentId } = req.params;

    const existsComment = await Comment.findOne({
        where: {
            userId,
            commentId,
        },
    });

    if (existsComment) {
        await existsComment.destroy();
        return res.json({
            message: "Your comment has been removed.",
        });
    } else {
        return res.status(404).json({
            message: "Comment not found or this is not your comment",
        });
    }
});

router.put("/posts/:postId/like", autoMiddleware, async (req, res) => {
    const { userId } = res.locals.user;
    const { postId } = req.params;
    const post = await Post.findByPk(postId)
    
    if (post) {
        console.log(userId)
        const existsLike = await Like.findOne({
            where: {
                postId,
                userId
            }
        });

        if (existsLike) {
            await existsLike.destroy();
            res.send({
                message: "You have unliked this post."
            })
        } else {
            await Like.create({
                postId,
                userId
            });
            res.send({
                message: "You have liked this post."
            })
        }
    } else {
        return res.status(404).json({
            message: "Post not found",
        });
    }
});

router.get("/posts-like", autoMiddleware, async (req, res) => {
    const { userId } = res.locals.user;

    const like = await Like.findAll({
        where: {
            userId
        }
    });

    const postIds = like.map((l) => l.postId);
    
    const posts = await Post.findAll({
        include: ['user','like'],
        where: {
            postId: postIds
        }
    });
    
    const data = posts.map(pl => ({
        postId: pl.postId,
        userId: pl.userId,
        nickname: pl.user.nickname,
        title: pl.title, 
        createdAt: pl.createdAt,
        updatedAt: pl.updatedAt,
        likes: pl.like.length
    }))
    // const sortData = data.sort((a, b) => (a.likes < b.likes) ? 1 : (a.likes > b.liks) ? -1 : 0)
    res.json({
        data: data
    })
});

app.use("/api", express.urlencoded({ extended: false }), router);
app.use(express.static("assets"));

app.listen(8080, () => {
    console.log("The server is ready to receive the request");
});