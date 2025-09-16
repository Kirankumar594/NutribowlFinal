import Benefit from '../models/Benefit.js';
import { uploadFile2, deleteFile } from '../middleware/aws.js';

export const getBenefits = async (req, res) => {
  try {
    const benefits = await Benefit.find().sort({ createdAt: -1 });
    res.status(200).json(benefits);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const createBenefit = async (req, res) => {
  try {
    const { title, description } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an icon' });
    }

    // Upload file to AWS S3
    const awsFile = await uploadFile2(req.file, "benefits");
    if (!awsFile || !awsFile.Location) {
      return res.status(500).json({ message: 'Failed to upload icon to cloud storage' });
    }

    const benefit = new Benefit({
      title,
      description,
      icon: awsFile.Location, // Store the S3 URL
      iconKey: awsFile.Key // Store the S3 key for future deletion
    });

    const createdBenefit = await benefit.save();
    res.status(201).json(createdBenefit);
  } catch (error) {
    res.status(400).json({ message: 'Invalid data', error: error.message });
  }
};

export const updateBenefit = async (req, res) => {
  try {
    const { title, description } = req.body;
    const benefit = await Benefit.findById(req.params.id);

    if (!benefit) {
      return res.status(404).json({ message: 'Benefit not found' });
    }

    let iconPath = benefit.icon;
    let iconKey = benefit.iconKey;
    
    if (req.file) {
      // Upload new icon to AWS S3
      const awsFile = await uploadFile2(req.file, "benefits");
      if (!awsFile || !awsFile.Location) {
        return res.status(500).json({ message: 'Failed to upload new icon to cloud storage' });
      }

      // Delete old icon from AWS S3 if exists
      if (benefit.iconKey) {
        try {
          await deleteFile(benefit.iconKey);
        } catch (deleteError) {
          console.error("Error deleting old icon from S3:", deleteError);
          // Continue with update even if deletion fails
        }
      }

      iconPath = awsFile.Location;
      iconKey = awsFile.Key;
    }

    const updatedBenefit = await Benefit.findByIdAndUpdate(
      req.params.id,
      {
        title: title || benefit.title,
        description: description || benefit.description,
        icon: iconPath,
        iconKey: iconKey
      },
      { new: true, runValidators: true }
    );
    
    res.status(200).json(updatedBenefit);
  } catch (error) {
    res.status(400).json({ message: 'Invalid data', error: error.message });
  }
};

export const deleteBenefit = async (req, res) => {
  try {
    const benefit = await Benefit.findById(req.params.id);

    if (!benefit) {
      return res.status(404).json({ message: 'Benefit not found' });
    }

    // Delete icon file from AWS S3 if exists
    if (benefit.iconKey) {
      try {
        await deleteFile(benefit.iconKey);
      } catch (deleteError) {
        console.error("Error deleting icon from S3:", deleteError);
        // Continue with deletion even if file deletion fails
      }
    }

    await Benefit.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Benefit removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};