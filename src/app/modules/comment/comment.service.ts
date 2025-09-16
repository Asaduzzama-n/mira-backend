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
import { sendNotification } from '../../../helpers/notificationHelper';

const createComment = async (user: JwtPayload, payload: Partial<IComment>) => {
  payload.user = user.authId;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const [createdComment, message] = await Promise.all([
      Comment.create([payload], { session }),
      Message.findByIdAndUpdate(
        payload.message,
        { $inc: { commentCount: 1 } },
        { session, new: true } // ensure we get updated message back
      ),
    ]);

    await session.commitTransaction();

    // notification payload
    const notificationData = {
      from: {
        authId: user.authId.toString(),
        name: user.name,
        profilePhoto: user.profile?.toString(),
      },
      title: `${user.name} commented on your message`,
      body: createdComment[0].content,
    };

    // build notification promises
    const notificationPromises = [];

    if (message?.sender) {
      notificationPromises.push(
        sendNotification(
          notificationData.from,
          message.sender.toString(),
          notificationData.title,
          notificationData.body
        )
      );
    }

    if (message?.isShared && message?.receiver) {
      notificationPromises.push(
        sendNotification(
          notificationData.from,
          message.receiver.toString(),
          notificationData.title,
          notificationData.body
        )
      );
    }

    await Promise.all(notificationPromises);

    return `Comment created successfully.`;
  } catch (error) {
    await session.abortTransaction();
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Failed to create comment, please try again later."
    );
  } finally {
    session.endSession();
  }
};

const removeComment = async(user:JwtPayload,commentId:Types.ObjectId)=>{
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const comment = await Comment.findByIdAndDelete(commentId,{session});
    if(!comment){
      throw new ApiError(StatusCodes.NOT_FOUND,"Comment not found.");
    }

    if(comment.user?.toString() !== user.authId.toString()){
      throw new ApiError(StatusCodes.FORBIDDEN,"You are not authorized to remove this comment.");
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


const reactForComment = async(commentId:Types.ObjectId, user:JwtPayload)=>{
  const comment = await Comment.findById(commentId);
  if(!comment){
    throw new ApiError(StatusCodes.NOT_FOUND,"The requested comment not found.");
  }
  if(comment.reactions.includes(user.authId)){
    //remove the user id from the array and save
    comment.reactions = comment.reactions.filter(id=>id.toString() !== user.authId.toString());
    await comment.save();
  }else{
    //add the user id to the array and save
    comment.reactions.push(user.authId);
    await comment.save();

    //send notification
      const notificationData = {
      from: {
        authId: user.authId.toString(),
        name: user.name,
        profilePhoto: user.profile?.toString(),
      },
      to: comment.user.toString(),
      title: `${user.name} reacted on your comment.`,
      body: `${user.name} reacted on your comment.`,
    };

    await sendNotification(notificationData.from, notificationData.to, notificationData.title, notificationData.body);
  }
  return `Comment reacted successfully.`;
}



export const CommentServices = {
  createComment,
  removeComment,
  getCommentByMessage,
  reactForComment,
};