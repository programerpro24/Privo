import React from 'react';
import "../app.css";
import { Link, useNavigate } from "react-router-dom";

const landing = () => {

    const router=useNavigate();
  return (
    <div className='landingPageContainer'>
        <nav>
            <div className='navHeader'>
                <h2>Privo</h2>
            </div>
            <div className='navlist'>
                <p onClick={()=>{
                    router("/a1b2c3")
                }}>Join As Guest</p>
                <p
                 onClick={()=>{
                    router("/auth")
                }}
                >Register</p>
                <div 
                onClick={()=>{
                    router("/auth")
                }}
                role='button'>
                    <p>login</p>
                </div>
            </div>
        </nav>

        <div className='landingMainContainer'>
            <div>
                <h1> <span style={{color:"#FF9839"}}>CONNECT </span> WITH YOUR LOVED ONES</h1>
                <p>Break the Barriers, Stay Connected with Privo</p>
                <div role='button'>
                    <Link to={"/auth"}>Get started</Link>
                </div>
            </div>
            <div>
                <img src="/mobile.png" alt="Image"/>
            </div>
        </div>

    </div>
  )
}

export default landing