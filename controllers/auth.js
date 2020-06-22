const bcrypt = require('bcryptjs');
const User = require('../models/user');
const nodemailer = require('nodemailer');
const sendgridTransport = require('nodemailer-sendgrid-transport');
const crypto = require('crypto');
// brackets{} because this package returns a bunch of things but we only want a few things.
const { validationResult } = require('express-validator/check');


//initialize/configure transporter to tell nodemiler how your emails will send cause nodejs can not do it by itself it requires a third party package.
//after initializing u can use this to send email.
   const transporter = nodemailer.createTransport(sendgridTransport({
    auth:{
      api_key:'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'
    }
  }));

exports.getLogin = (req, res , next)=>{
    // console.log(req.get('Cookie').split(';')[0].split('=')[1]);
    // const isLoggedIn = req.get('Cookie').split(';')[0].trim().split('=')[1]; 
//    console.log(req.session.isLoggedIn);
     let message = req.flash('error');
     if(message.length > 0){
       //since its an array 
       message = message[0]
     }else{
       message = null;
     }
    res.render('auth/login',{
        path:'/login',
        pageTitle:'Login',
        errorMessage : message,
        oldInput:{
          email:'',
          password:''
        },
        validationErrors :[]
    });
};

exports.postLogin = (req, res , next) =>{ 
  const email = req.body.email;
  const password = req.body.password;
  const errors = validationResult(req);
  if(!errors.isEmpty()){
    console.log(errors.array());
    return res.status(422).render('auth/login' ,{
      path:'/login',
      pageTitle:'login',
      errorMessage: errors.array()[0].msg,
      oldInput :{
        email: email,
        password : password
      },
       validationErrors : errors.array()
     });
  }
     User.findOne( {email:email})
      .then(user =>{
        if(!user){  
          return res.status(422).render('auth/login' ,{
            path:'/login',
            pageTitle:'login',
            errorMessage: 'Invalid email or password',
            oldInput :{
              email: email,
              password : password
            },
             validationErrors : []
            });
         }
      //compare the pasword with bcrypt(returns a boolean value) beacuse we can not decrypt the hased pasword.
       bcrypt.compare(password, user.password)
         .then( doMatch =>{
           //then() will be executed either the pasword match or not
           if(doMatch){
            req.session.user = user;
            req.session.isLoggedIn = true;
            //return here cause the login was succesful and prevent that lower redirect to login.
            return req.session.save( err =>{
              console.log(err);
              res.redirect('/');
            });
           }
           return res.status(422).render('auth/login' ,{
            path:'/login',
            pageTitle:'login',
            errorMessage: 'Invalid email or password',
            oldInput :{
              email: email,
              password : password
            },
             validationErrors : []
            }); 
         })
         .catch(err =>{
           //error will occur only if something goes wrong not when pasword dont match
           console.log(err);
           res.redirect('/login');
        })
      .catch(err =>{ 
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
      });     
  })
};




exports.postLogout = (req, res, next) =>{
    req.session.destroy( err=>{
      console.log(err);
      res.redirect('/');
    });
};


exports.getSignup = (req, res, next) =>{
  let message = req.flash('error');
  if(message.length > 0){
    //since its an array 
    message = message[0]
  }else{
    message = null;
  }
 res.render('auth/signup' ,{
  path:'/signup',
  pageTitle:'Signup',
  errorMessage: message,
  oldInput:{
    email:'',
    password:'',
    confirmPassword:''
  },
  validationErrors :[]
 });
};

exports.postSignup = (req, res, next) =>{
  const email = req.body.email;
  const password = req.body.password;
  const errors = validationResult(req);
  if(!errors.isEmpty()){
    console.log(errors.array());
    return res.status(422).render('auth/signup' ,{
      path:'/signup',
      pageTitle:'Signup',
      errorMessage: errors.array()[0].msg,
      oldInput :{
        email: email,
        password : password,
        confirmPassword : req.body.confirmPassword
      },
      validationErrors : errors.array()
     });
  }

  //  create a hash password
    bcrypt.hash(password , 12)
       .then( hashedPassword =>{
         const user = new User({
         email:email,
         password:hashedPassword,
         cart:{ item:[] }
       });
         return user.save();
   })
     .then(result =>{
     res.redirect('/login');
     transporter.sendMail({
       to:email ,
       from:'shorosummaiya@gmail.com',
       subject:'SignUp completed!',
       html:'<h1> You successfully signed up! </h1>'
     });
    })
    .catch(err =>{
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
   });
  };


 exports.getReset = (req, res ,next)=> {
  let message = req.flash('error');
  if(message.length > 0){
    //since its an array 
    message = message[0]
  }else{
    message = null;
  }
 res.render('auth/reset' ,{
  path:'/reset',
  pageTitle:'Reset',
  errorMessage: message
 });
 };

exports.postReset =(req, res , next) =>{
  crypto.randomBytes(32 , (err , buffer)=>{
     if(err){
       console.log(err);
       return res.redirect('/reset');
     }
     const token = buffer.toString('hex');  // this token should be stored on database / cause it belongs to user.
     User.findOne({email : req.body.email})
     .then(user =>{
       if(!user){
         req.flash('error' ,'No account  with that email found ');
         return res.redirect('/reset');
       }
       user.resetToken = token;
       user.resetTokenExpiration = Date.now() + 3600000;
       user.save();
     })
     .then(result =>{
       res.redirect('/');
        transporter.sendMail({
        to: req.body.email ,
        from:'shorosummaiya@gmail.com',
        subject:'Password reset!',
        html:`<p> you requested a password reset</p>
          <p>Click this <a href="http://localhost:3000/reset/${token}">link</a>to set a new password </p>
         `
        });
     })
     .catch(err =>{
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
     });
  });
};

exports.getNewPassword = (req,res, next) =>{
  const token = req.params.token;
  User.findOne({resetToken:token , resetTokenExpiration : {$gt : Date.now() }})
  .then( user =>{
    let message = req.flash('error');
  if(message.length > 0){
    //since its an array 
    message = message[0]
  }else{
    message = null;
  }
 res.render('auth/new-password' ,{
  path:'new-password',
  pageTitle:'New Password',
  errorMessage: message,
  userId:user._Id.toString(),
  passwordToken:token 
 });
 })
  .catch(err =>{
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  });
};


exports.postNewPassword = (req, res , next) =>{
  const newPassword = req.body.password;
  const passwordToken = req.body.passwordToken;
  const userId = req.body.userId;
  let resetUser;

  User.findOne({resetToken : passwordToken , resetTokenExpiration : {$gt : Date.now()} , _id :userId })
  .then(user =>{
    resetUser = user;
    return bcrypt.hash(newPassword , 12);
  })
  .then(hashedPassword =>{
    resetUser.password = hashedPassword;
    resetUser.resetToken = undefined;
    resetUser.resetTokenExpiration = undefined;
    return resetUser.save();
  })
  .then(result =>{
    res.redirect('/login');
  })
  .catch(err =>{
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  });
};