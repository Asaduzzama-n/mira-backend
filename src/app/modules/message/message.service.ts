import { JwtPayload } from "jsonwebtoken"
import { IMessage } from "./message.interface"
import { User } from "../user/user.model";
import { USER_STATUS } from "../../../enum/user";
import { Message } from "./message.model";
import { IPaginationOptions } from "../../../interfaces/pagination";
import { paginationHelper } from "../../../helpers/paginationHelper";
import { IGenericResponse } from "../../../interfaces/response";
import { IUser } from "../user/user.interface";

const sendMessageToRandomUserOptimized = async (
  user: JwtPayload, 
  payload: Partial<IMessage>
) => {
  try {
    payload.sender = user.authId;

    const result = await User.aggregate([
      { 
        $match: { 
          authId: { $ne: user.authId },
          status:USER_STATUS.ACTIVE
        } 
      },
      { $sample: { size: 1 } },
      { 
        $project: { 
          _id: 1 
        } 
      }
    ]);

    if (result.length === 0) {
      return { success: false, error: 'No other users available' };
    }

    const randomUser = result[0];
    
   console.log(randomUser)

    const message = await Message.create({
      ...payload,
      receiver: randomUser._id,
    })
    return `Message sent successfully.`;

  } catch (error) {
    console.error('Error sending optimized message to random user:', error);
    return { success: false, error: 'Failed to send message' };
  }
};


const getMyMessages = async (user: JwtPayload, pagination: IPaginationOptions) => {
  const { page, limit,skip, sortBy, sortOrder } = paginationHelper.calculatePagination(pagination);
  
  const [messages, total] = await Promise.all([
    Message.find({
      receiver: user.authId,
    }).populate<{sender:Partial<IUser>}>({
      path:'sender',
      select:'firstName lastName profile'
    }).populate<{receiver:Partial<IUser>}>({
      path:'receiver',
      select:'firstName lastName profile'
    })
    .sort({[sortBy]: sortOrder}).skip(skip).limit(limit).lean(),
    Message.countDocuments({
      receiver: user.authId,
    })
  ])

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    data:messages || []
  }
}

const getMessageByUserId = async (userId: string, pagination: IPaginationOptions) => {
  const { page, limit,skip, sortBy, sortOrder } = paginationHelper.calculatePagination(pagination);
  const [messages, total] = await Promise.all([
    Message.find({
      $or: [
        { sender: userId },
        { receiver: userId },
      ],
    }).populate<{sender:Partial<IUser>}>({
      path:'sender',
      select:'firstName lastName profile'
    }).populate<{receiver:Partial<IUser>}>({
      path:'receiver',
      select:'firstName lastName profile'
    }).sort({[sortBy]: sortOrder}).skip(skip).limit(limit).lean(),
    Message.countDocuments({
      $or: [
        { sender: userId },
        { receiver: userId },
      ],
    })
  ])
  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    data:messages || []
  };
}

export const MessageServices = {
  sendMessageToRandomUserOptimized,
  getMyMessages,
  getMessageByUserId
}