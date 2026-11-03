import { createContext, useContext } from 'react';
import type { Course } from '../../lib/contracts';
export const CourseContext=createContext<{courseId:string;select:(id:string)=>void;courses:Course[]}>({courseId:'',select:()=>{},courses:[]});
export const useCourse=()=>useContext(CourseContext);
