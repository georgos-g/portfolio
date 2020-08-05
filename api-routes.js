const express = require('express');
const router = new express.Router();

const db = require('./db.js');
const ses = require('./ses.js');

const passwords = require('./passwords.js');
const cryptoRandomString = require("crypto-random-string");

const multer = require('multer');
const s3 = require('./s3.js');






router.post('/api/v1/register', (request, response) => {
    const { firstname, lastname, email, password } = request.body;
    
    passwords
        .hash(password)
        .then((password_hash) =>
            db.addNewUser(firstname, lastname, email, password_hash)
        
        )
        .then((addNewUser) => {
            request.session.userID = addNewUser.id;

            response.json({
                success: true,
                user: addNewUser,

            });
        })
        .catch((error) => {
            console.log(error);
            response.json({
                success: false,
                error: 'All fields must be filled out.'

            });        
        });    
});


///Route for login

router.post('/api/v1/login', (request, response) => {
    //check if fields are filled 
    const { email, password } = request.body;
    
    if (!email || !password) {
        return response.redirect('register', {
            error: 'Required field/s are missing',
            email,
            password,

        });
    }
    //compare pasword_hash with DB
    db.getUserByEmail(email)
        .then((result) => {
            
            const userPasswordHashFromDB = result.password_hash;
            //hashing
            passwords.compare(password, userPasswordHashFromDB).then((isCorrect) => {
                
                if (isCorrect) {
                    request.session.userID = result.id;
                    response.json({ success: true });
                }
    
                
            });
        }).catch(error => {
            console.log(error);
        
            response.json({
                success: false,
                error: 'Your email or passwort are incorrect.'

            });
        });
});
    


//Route to reset password
router.post('/api/v1/password-reset/code', (request, response) => {
    const { email } = request.body;
    const secretCode = cryptoRandomString({ length: 6 });

    db.addPasswordReset(email, secretCode).then((result) => {
        
        if (result) {
        //send email with new password
            const emailBody = `Use this code <span>${secretCode}</span> to change your password.`;
            ses.send(email, 'Password reset code', emailBody).then(() => {
           
            //send message 
                response.json({ success: true });
            });
        } else {
            response.json({ success: false, error: 'Something did not worked out!' });

        }
    });
   
});







//Route for set new password
router.post('/api/v1/password-reset/set-password', (request, response) => {
    
    //get email, code, new password from request body
    const { email, code, password } = request.body;
    
    //check if email belongs to any user  
    db.getCodeByEmail(code, email).then((result) => {
        
        
    //check if code from db is the same as code from request        
        if (result) {
          
            //hash the password
            db.getUserByEmail(email).then(user => {
                
                const userId = user.id;   
                passwords.hash(password).then((password_hash) => {
                    
                    db.updatePassword(userId, password_hash).then((result) => {
                         
                        response.json({ success: true });
                    });
                });
            });    
            
        } else {
            response.json({ success: false, error: 'Code invalid' });
        }
      
    });

});
//User Details
router.get('/api/vi/me', (request, response) => {
    const userId = request.session.userId;

    if (!userId) {
        return response.json({});

    } else {
        db.getUser(userId)
            .then(user => {
                delete user.password_hash;
                response.json(user);

            })
            .catch(error => {
                console.log("error", error); 
                response.status(500).json(error);
            });
    }
});

//multer img upload
const diskStorage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, __dirname + '/uploads');
    },
    filename: function (req, file, callback) {
        uidSafe(24).then(function(uid) {
            callback(null, uid + path.extname(file.originalname));
        });
    }
});

const uploader = multer({
    storage: diskStorage,
    limits: {
        fileSize: 5242880//5MB
    }
});

//upload files to AWS S3---------------------------------------------------- 
router.post('/api/v1/user/profile-upload', uploader.single('file'), (request, response) => {
    const s3ImageURL = s3.generateBucketURL(request.file.filename);
    s3.uploadFile(request.file)
        
        .then(() => {
            const { firstname, lastname, email, profile_picture_url } = request.body;
            return db.addImage(s3ImageURL, firstname, lastname, email, profile_picture_url);                  
        })

        .then((resultFromDb) => {
            const imageInfoFromDB = resultFromDb.rows[0];
            response.json({
                success: true,
                //fileURL: s3ImageURL, 
                ...imageInfoFromDB,
            });                    
        })

        .catch((error) => {
            response.status(500).json({
                success: false,
                error: error,


            });
        
        });
}); 


//get image????
router.get('/api/v1/user/image/:id', (request, response) => {
    
    db.getImage(request.params.id)
        .then(imageInfo => {
            response.json(imageInfo); 
        })
        .catch((error) => {
            response.status(500).json({
                success: false,
                error: error,


            });
    
        });

});




module.exports = router;