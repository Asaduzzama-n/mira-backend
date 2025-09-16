import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { ICommentFilterables, IComment } from './comment.interface';
import { Comment } from './comment.model';
import { JwtPayload } from 'jsonwebtoken';
import { IPaginationOptions } from '../../../interfaces/pagination';
import { paginationHelper } from '../../../helpers/paginationHelper';
import { commentSearchableFields } from './comment.constants';
import mongoose, { Types } from 'mongoose';
import { Message } from '../message/message.model';

const createComment = async(user:JwtPayload, payload:Partial<IComment>)=>{
  payload.user = user.authId

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const [createdComment, message] = await Promise.all([
      await Comment.create([payload],{session}),
      await Message.findByIdAndUpdate(payload.message,{
        $inc:{
          commentCount:1
        }
      },{session})
    ]);
    await session.commitTransaction();
    //send notification to sender, also send notification to receiver only if they shared the message
    
    return `Comment created successfully.`;
  } catch (error) {
    await session.abortTransaction();
    throw new ApiError(StatusCodes.BAD_REQUEST,"Failed to create comment, please try again later.");
  }

}

const removeComment = async(commentId:Types.ObjectId)=>{
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const comment = await Comment.findByIdAndDelete(commentId,{session});
    if(!comment){
      throw new ApiError(StatusCodes.NOT_FOUND,"Comment not found.");
    }
    await Message.findByIdAndUpdate(comment.message,{
      $inc:{
        commentCount:-1
      }
    },{session})
    await session.commitTransaction();
    return `Comment removed successfully.`;
  } catch (error) {
    await session.abortTransaction();
    throw new ApiError(StatusCodes.BAD_REQUEST,"Failed to remove comment, please try again later.");
  }
}

const getCommentByMessage = async(messageId:Types.ObjectId, pagination:IPaginationOptions)=>{
  const {page,limit,skip,sortBy,sortOrder} = paginationHelper.calculatePagination(pagination);
  const [total,comments] = await Promise.all([
    Comment.countDocuments({
      message:messageId
    }),
    Comment.find({
      message:messageId
    }).populate({
      path:'user',
      select:'firstName lastName profile'
    }).sort({
      [sortBy]:sortOrder
    }).skip(skip).limit(limit).lean()
  ]);
  return {
    meta:{
      page,
      limit,
      total:comments.length,
      totalPage:Math.ceil(total/limit)
    },
    data:comments
  }
}

export const CommentServices = {
  createComment,
  removeComment,
  getCommentByMessage,
};