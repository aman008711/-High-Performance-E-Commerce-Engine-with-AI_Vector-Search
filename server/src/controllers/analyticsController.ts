import { Request, Response, NextFunction } from 'express';
import { SearchLog } from '../models/SearchLog';
import { Product } from '../models/Product';

export const getSearchAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const totalSearches = await SearchLog.countDocuments();
    const unansweredCount = await SearchLog.countDocuments({ resultsCount: 0 });

    const typeDistributionRaw = await SearchLog.aggregate([
      { $group: { _id: '$searchType', count: { $sum: 1 } } }
    ]);

    const typeDistribution = {
      text: 0,
      vector: 0,
      image: 0
    };

    typeDistributionRaw.forEach(item => {
      if (item._id === 'text') typeDistribution.text = item.count;
      if (item._id === 'vector') typeDistribution.vector = item.count;
      if (item._id === 'image') typeDistribution.image = item.count;
    });

    const topQueries = await SearchLog.aggregate([
      {
        $group: {
          _id: { query: '$query', type: '$searchType' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          query: '$_id.query',
          type: '$_id.type',
          count: 1
        }
      }
    ]);

    const unansweredQueries = await SearchLog.aggregate([
      { $match: { resultsCount: 0 } },
      {
        $group: {
          _id: '$query',
          count: { $sum: 1 },
          lastSearched: { $max: '$timestamp' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          query: '$_id',
          count: 1,
          lastSearched: 1
        }
      }
    ]);

    // Trend for the last 14 days (using UTC to prevent timezone shifts)
    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);
    startDate.setUTCDate(startDate.getUTCDate() - 14);

    const trendsRaw = await SearchLog.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill in missing dates to make a continuous trend line
    const trends: { date: string; count: number }[] = [];
    const tempDate = new Date(startDate);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    while (tempDate <= today) {
      const dateStr = tempDate.toISOString().split('T')[0];
      const match = trendsRaw.find(t => t._id === dateStr);
      trends.push({
        date: dateStr,
        count: match ? match.count : 0
      });
      tempDate.setUTCDate(tempDate.getUTCDate() + 1);
    }

    res.status(200).json({
      status: 'success',
      data: {
        totalSearches,
        unansweredCount,
        typeDistribution,
        topQueries,
        unansweredQueries,
        trends
      }
    });
  } catch (error) {
    next(error);
  }
};

export const clearSearchLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await SearchLog.deleteMany({});
    res.status(200).json({
      status: 'success',
      message: 'Search logs cleared successfully'
    });
  } catch (error) {
    next(error);
  }
};
