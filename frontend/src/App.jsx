import React from 'react';
import {Route, BrowserRouter as Router, Routes} from 'react-router-dom'; 
import LandingPage from './pages/landing'
import Authentication from './pages/authentication';
import { AuthProvider } from './contexts/AuthContext';
import VideoMeet from './pages/VideoMeet';
import Home from './pages/Home';
import History from './pages/History';


export default function App() {

   
  return (
 <div className='App'>
    <Router>
         <AuthProvider>
                <Routes>
                   <Route path='/' element={<LandingPage/>}/>
                   <Route path='/auth' element={<Authentication/>}/>
                   <Route path='/home' element={<Home/>}/>
                   <Route path='/history' element={<History/>}/>
                    <Route path='/:url' element = {<VideoMeet/>}/>
               </Routes>
        </AuthProvider>
    </Router>
 </div>
  )
}
