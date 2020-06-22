const path = require('path');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const User = require('./models/user');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const csrf = require('csurf');
const flash = require('connect-flash');
const multer = require('multer');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const https = require('https');

//controller
const errorController = require('./controllers/error');
//mongodb+srv://me:12345@cluster0-tzdgu.mongodb.net/shop?retryWrites=true&w=majority
const MONGODB_URI = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0-tzdgu.mongodb.net/${process.env.MONGO_DEFAULT_DATABASE}?retryWrites=true&w=majority`;
const app = express();
const store = new MongoDBStore({
  uri:MONGODB_URI,
   // must define collection name where u want to store your session data
  collection : 'sessions'
});

//applying ssl/tsl
// const privateKey = fs.readFileSync('key.pem');
// const certificate = fs.readFileSync('csr.pem');
  
//create csrf middleware
const csrfProtection = csrf();

//filestorage for images
const fileStorage = multer.diskStorage({
  destination: (req, file , cb)=>{
     //null = it tells multer that there is something wrong with the incoming file and it should not store it ?check it again it is right or not
     cb(null, 'images');  // image is wher u want to store the image
  },
  filename:(req, file , cb)=>{
    // new Date().toISOString  = it is cause we want every image to have a unique name
    // even if two same imges are uploaded make sure o give them unique name so that they dont overlap
    cb(null , new Date().toISOString().replace(/:/g, '-') + '-' + file.originalname );  //replace(/:/g, '-') cause Windows OS file don't accept ":" (colon) named and date will look like this 1996-10-15T00:05:32.000Z
  }
});

//creating specicifier for image type//setting the filter to tell multer to only certain kind of files  
const fileFilter = (req, file, cb)=>{
  if(
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpg' || 
    file.mimetype === 'image/jpeg'){
     cb(null , true);
  }else{
    cb(null , false);
  }
};

app.set('view engine', 'ejs');
app.set('views', 'views');

//routes
const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shop');
const authRoutes = require('./routes/auth');


//create access.log file for writing all logging request info in it 
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'),{ flags: 'a'});

//using helemt as middleware to set response headers
app.use(helmet());
//using compression for optimized assets
app.use(compression());
//combined format , log request data to a file , to know whts going on on your server(to see this in file instead of in console create writestream , a file that will hold all info )
app.use(morgan('combined' , {stream: accessLogStream}));

app.use(bodyParser.urlencoded({ extended: false }));
//  app.use(multer({dest: 'images'}).single('image'));
app.use(multer({ storage : fileStorage , fileFilter :fileFilter}).single('image'));  //image is the name of input that will hold the multer(image) file
app.use(express.static(path.join(__dirname, 'public')));
app.use( '/images',express.static(path.join(__dirname, 'images')));


//creates session
app.use(session({  
  secret:'my secret',
  resave:false ,
  saveUninitialized:false ,
  store:store })
);


//use csrf protection token 
app.use(csrfProtection);

//register/initialize flash
app.use(flash());

// For every request these two fields will be set for the views that are rendered. 
app.use((req , res , next)=>{
  //locals means it will only exits in the views that are rendered.
  res.locals.isAuthenticated = req.session.isLoggedIn;
  res.locals.csrfToken = req.csrfToken();
  next(); 
});


//create/access user for a session / enable  the mongoose model rather then using mongodb 
app.use( (req,res, next) =>{
  // throw new Error('sync dummy');
  if(!req.session.user){
    //return will not execute the later part of this middleware.
    return next();
  }
  User.findById(req.session.user._id)
  .then( user =>{
    // re.user=user will store user even if the user=null to avoid this put a if() block
    if(!user){
      return next();  // so that req.user do not store an empty user 
    }
    req.user = user;
    next();
  })
  .catch( err =>{
    //this will be executed if there is a technical error only not when the user not found.
     //throw new Error(err);  ==> this will not work in async code
     next(new Error(err));
    });
});

//use routes
app.use('/admin', adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

app.get('/500', errorController.get500);
app.use(errorController.get404);

//if oyu will use normal middleware here for error handling it will not be executed cause 404 middleware will get executed.
app.use((error, req, res , next) =>{
  console.log(error);
  //res.status(http.httpStatusCode).render(..);
  // res.redirect('/500');
  res.status(500).render('500',{
    pageTitle: 'Error', 
    path: '/500' , 
    isAuthenticated : req.session.isLoggedIn
   });
});

mongoose.connect( MONGODB_URI,{ useNewUrlParser:true , useUnifiedTopology:true })
  .then(result => {
    //https.createServer({key: privateKey , cert:certificate }, app).listen(process.env.PORT || 5000);
    app.listen(process.env.PORT || 5000);
  })
  .catch(err => {
    console.log(err);
  });
