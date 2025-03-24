import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceDot, Label, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import _ from 'lodash';

const AdvancedServerOpportunityCostCalculator = () => {
  // Days of the week
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const mealPeriods = ['Lunch', 'Dinner'];
  
  // Initial state for servers
  const initialServerState = {
    name: '',
    wage: 4.74,
    phoneTimePercent: 15, // Individual phone time percentage
    tipPercent: 18, // Individual tip percentage
    hours: Array(7).fill().map(() => ({
      lunch: 0,
      dinner: 0
    }))
  };
  
  // State for inputs
  const [servers, setServers] = useState([{...initialServerState, name: 'Server 1'}]);
  const [checkSizes, setCheckSizes] = useState({
    lunch: Array(7).fill(25),  // Lower for lunch
    dinner: Array(7).fill(35)  // Higher for dinner
  });
  const [phoneTimePercent, setPhoneTimePercent] = useState(15);
  const [upsellValue, setUpsellValue] = useState(10);
  const [upsellMargin, setUpsellMargin] = useState(50);
  const [missedUpsellsPerHour, setMissedUpsellsPerHour] = useState(3);
  const [slangAIReduction, setSlangAIReduction] = useState(70);
  const [tablesPerHour, setTablesPerHour] = useState(3);
  const [slangPlan, setSlangPlan] = useState(399);
  const [netProfitPercent, setNetProfitPercent] = useState(15);
  
  // State for chart data
  const [chartData, setChartData] = useState([]);
  const [impactData, setImpactData] = useState([]);
  const [serverImpactData, setServerImpactData] = useState([]);
  const [dayOfWeekData, setDayOfWeekData] = useState([]);
  
  // Calculate weighted average phone time (memoized to avoid dependency issues)
  const calculateWeightedPhoneTime = useCallback(() => {
    if (!servers || servers.length === 0) return 15;
    
    const totalHours = servers.reduce((sum, server) => {
      return sum + server.hours.reduce((daySum, day) => {
        return daySum + (day.lunch || 0) + (day.dinner || 0);
      }, 0);
    }, 0);
    
    if (totalHours <= 0) return 15;
    
    // Weight each server's phone time by their total hours
    const weightedSum = servers.reduce((sum, server) => {
      const serverHours = server.hours.reduce((daySum, day) => {
        return daySum + (day.lunch || 0) + (day.dinner || 0);
      }, 0);
      return sum + ((server.phoneTimePercent || 15) * serverHours);
    }, 0);
    
    return Math.round(weightedSum / totalHours);
  }, [servers]);
  
  // Add a new server
  const addServer = () => {
    const newServers = [...servers];
    newServers.push({...initialServerState, name: `Server ${servers.length + 1}`});
    setServers(newServers);
  };
  
  // Remove a server
  const removeServer = (index) => {
    if (servers.length > 1) {
      const newServers = [...servers];
      newServers.splice(index, 1);
      setServers(newServers);
    }
  };
  
  // Update server information
  const updateServerName = (index, name) => {
    const newServers = [...servers];
    newServers[index].name = name;
    setServers(newServers);
  };
  
  const updateServerWage = (index, wage) => {
    const newServers = [...servers];
    newServers[index].wage = wage;
    setServers(newServers);
  };
  
  const updateServerTipPercent = (index, percent) => {
    const newServers = [...servers];
    newServers[index].tipPercent = percent;
    setServers(newServers);
  };
  
  const updateServerPhoneTime = (index, percent) => {
    const newServers = [...servers];
    newServers[index].phoneTimePercent = percent;
    setServers(newServers);
  };
  
  const updateServerHours = (serverIndex, dayIndex, mealPeriod, hours) => {
    const newServers = [...servers];
    newServers[serverIndex].hours[dayIndex][mealPeriod] = hours;
    setServers(newServers);
  };
  
  // Update check sizes
  const updateCheckSize = (mealPeriod, dayIndex, value) => {
    const newCheckSizes = {...checkSizes};
    newCheckSizes[mealPeriod][dayIndex] = value;
    setCheckSizes(newCheckSizes);
  };
  
  // Update average phone time when phone time is calculated
  useEffect(() => {
    const calculatedAvg = calculateWeightedPhoneTime();
    if (Math.abs(calculatedAvg - phoneTimePercent) > 1) {
      setPhoneTimePercent(calculatedAvg);
    }
  }, [servers, calculateWeightedPhoneTime]);
  
  // Calculate opportunity costs and impacts
  useEffect(() => {
    if (!servers || servers.length === 0) return;
    
    // Constants for calculations
    const weeksPerMonth = 4.3;
    
    // Calculate total weekly hours and build day/meal breakdowns
    let totalWeeklyHours = 0;
    const hoursByDayMeal = {
      lunch: Array(7).fill(0),
      dinner: Array(7).fill(0)
    };
    
    const serverOpportunityCosts = servers.map(server => {
      let serverWeeklyHours = 0;
      let serverOpportunityCost = 0;
      let serverWithSlangAICost = 0;
      
      // Calculate server's hours and opportunity costs
      daysOfWeek.forEach((day, dayIndex) => {
        mealPeriods.forEach(mealPeriod => {
          const hours = server.hours[dayIndex][mealPeriod.toLowerCase()] || 0;
          if (hours) {
            serverWeeklyHours += hours;
            hoursByDayMeal[mealPeriod.toLowerCase()][dayIndex] += hours;
            totalWeeklyHours += hours;
          }
        });
      });
      
      // Phone time calculations - use server's individual phone time
      const phoneTimePercDecimal = (server.phoneTimePercent || 15) / 100;
      const phoneHoursPerWeek = serverWeeklyHours * phoneTimePercDecimal;
      const phoneHoursPerMonth = phoneHoursPerWeek * weeksPerMonth;
      
      // 1. Direct Labor Cost
      const directLaborCost = phoneHoursPerMonth * (server.wage || 4.74);
      
      // 2. Lost Upsell Revenue - Weighted by day/meal period
      let lostUpsellProfit = 0;
      let lostTips = 0;
      
      // Calculate a more realistic lost tips value that accounts for multitasking
      // Not all phone time directly impacts table service
      const multitaskingFactor = 0.7; // Only 70% of phone time truly impacts table service
      
      daysOfWeek.forEach((day, dayIndex) => {
        mealPeriods.forEach(mealPeriod => {
          const hours = server.hours[dayIndex][mealPeriod.toLowerCase()] || 0;
          if (hours) {
            const mealPhoneHours = hours * phoneTimePercDecimal * weeksPerMonth;
            const checkSize = checkSizes[mealPeriod.toLowerCase()][dayIndex] || 0;
            
            // Lost upsell calculation
            const mealMissedUpsells = mealPhoneHours * missedUpsellsPerHour;
            const mealLostUpsellRevenue = mealMissedUpsells * upsellValue;
            const mealLostUpsellProfit = mealLostUpsellRevenue * (upsellMargin / 100);
            lostUpsellProfit += mealLostUpsellProfit;
            
            // More realistic lost tips calculation that accounts for multitasking
            const mealTablesNotServed = mealPhoneHours * tablesPerHour * multitaskingFactor;
            const mealLostCheckRevenue = mealTablesNotServed * checkSize;
            const mealLostTips = mealLostCheckRevenue * ((server.tipPercent || 18) / 100);
            lostTips += mealLostTips;
          }
        });
      });
      
      // 3. Total Opportunity Cost
      serverOpportunityCost = directLaborCost + lostUpsellProfit + lostTips;
      
      // 4. With Slang.AI
      const reducedPhoneHoursPerMonth = phoneHoursPerMonth * (1 - (slangAIReduction / 100));
      const reducedDirectLaborCost = reducedPhoneHoursPerMonth * (server.wage || 4.74);
      
      // Apply the same reduction factor to upsell and tip losses
      const reductionFactor = (1 - (slangAIReduction / 100));
      const reducedLostUpsellProfit = lostUpsellProfit * reductionFactor;
      const reducedLostTips = lostTips * reductionFactor;
      
      // Each server's share of the subscription
      const serverShareOfSubscription = (serverWeeklyHours / Math.max(totalWeeklyHours, 1)) * slangPlan;
      serverWithSlangAICost = reducedDirectLaborCost + reducedLostUpsellProfit + reducedLostTips + serverShareOfSubscription;
      
      return {
        name: server.name || `Server ${servers.indexOf(server) + 1}`,
        wage: server.wage || 4.74,
        weeklyHours: serverWeeklyHours,
        monthlyHours: serverWeeklyHours * weeksPerMonth,
        phoneHours: phoneHoursPerMonth,
        directLaborCost,
        lostUpsellProfit,
        lostTips,
        totalOpportunityCost: serverOpportunityCost,
        withSlangAICost: serverWithSlangAICost,
        savings: serverOpportunityCost - serverWithSlangAICost
      };
    });
    
    // Update server impact data for visualization
    setServerImpactData(serverOpportunityCosts);
    
    // Generate data points for phone time percentage impact (5% to 25%)
    const percentagePoints = [];
    for (let percent = 5; percent <= 25; percent += 1) {
      percentagePoints.push(percent);
    }
    
    const phoneTimeData = percentagePoints.map(percent => {
      const percentDecimal = percent / 100;
      const phoneHoursPerWeek = totalWeeklyHours * percentDecimal;
      const phoneHoursPerMonth = phoneHoursPerWeek * weeksPerMonth;
      
      // Calculate the weighted totals across all servers and meal periods
      let totalDirectLaborCost = 0;
      let totalLostUpsellProfit = 0;
      let totalLostTips = 0;
      
      servers.forEach(server => {
        // For the chart data, use the percentage point we're calculating for
        // not the server's individual percentage (to show what happens if everyone had the same %)
        const serverPhoneHoursPerMonth = server.hours.reduce((total, dayHours) => {
          return total + ((dayHours.lunch || 0) + (dayHours.dinner || 0));
        }, 0) * percentDecimal * weeksPerMonth;
        
        // Direct labor cost
        totalDirectLaborCost += serverPhoneHoursPerMonth * (server.wage || 4.74);
        
        // Calculate weighted lost upsell and tips for each day and meal period
        daysOfWeek.forEach((day, dayIndex) => {
          mealPeriods.forEach(mealPeriod => {
            const hours = server.hours[dayIndex][mealPeriod.toLowerCase()] || 0;
            if (hours) {
              const mealPhoneHours = hours * percentDecimal * weeksPerMonth;
              const checkSize = checkSizes[mealPeriod.toLowerCase()][dayIndex] || 0;
              
              // Lost upsell calculation
              const mealMissedUpsells = mealPhoneHours * missedUpsellsPerHour;
              const mealLostUpsellRevenue = mealMissedUpsells * upsellValue;
              const mealLostUpsellProfit = mealLostUpsellRevenue * (upsellMargin / 100);
              totalLostUpsellProfit += mealLostUpsellProfit;
              
              // Lost tips calculation - using server's individual tip percentage
              // Account for multitasking ability
              const multitaskingFactor = 0.7; // Only 70% of phone time truly impacts table service
              const mealTablesNotServed = mealPhoneHours * tablesPerHour * multitaskingFactor;
              const mealLostCheckRevenue = mealTablesNotServed * checkSize;
              const mealLostTips = mealLostCheckRevenue * ((server.tipPercent || 18) / 100);
              totalLostTips += mealLostTips;
            }
          });
        });
      });
      
      const totalOpportunityCost = totalDirectLaborCost + totalLostUpsellProfit + totalLostTips;
      
      // With Slang.AI
      const reducedPhoneHoursPerMonth = phoneHoursPerMonth * (1 - (slangAIReduction / 100));
      const reducedDirectLaborCost = totalDirectLaborCost * (1 - (slangAIReduction / 100));
      const reducedLostUpsellProfit = totalLostUpsellProfit * (1 - (slangAIReduction / 100));
      const reducedLostTips = totalLostTips * (1 - (slangAIReduction / 100));
      
      const withSlangAICost = reducedDirectLaborCost + reducedLostUpsellProfit + reducedLostTips + slangPlan;
      const savings = totalOpportunityCost - withSlangAICost;
      
      return {
        phoneTimePercent: percent,
        withoutSlangAI: totalOpportunityCost,
        withSlangAI: withSlangAICost,
        savings: savings,
        laborCost: totalDirectLaborCost,
        lostUpsellProfit: totalLostUpsellProfit,
        lostTips: totalLostTips
      };
    });
    
    setChartData(phoneTimeData);
    
    // Calculate impact breakdown for current percentage
    const currentPercentData = phoneTimeData.find(data => Math.abs(data.phoneTimePercent - phoneTimePercent) < 0.01);
    
    if (currentPercentData) {
      // More nuanced breakdown that shows both costs and potential gains
      
      // Calculate positive impacts of handling phone calls
      const reservationsPerPhoneHour = 0.7; // Assume 0.7 successful reservations per phone hour
      const avgReservationValue = 120; // Average value of a reservation in dollars
      const conversionRate = 0.4; // 40% of calls lead to a reservation or order
      
      // Total phone hours per month
      const totalPhoneHours = totalWeeklyHours * (phoneTimePercent / 100) * weeksPerMonth;
      
      // Revenue generated from successful phone calls
      const phoneRevenueGenerated = totalPhoneHours * reservationsPerPhoneHour * avgReservationValue * conversionRate;
      
      // Net profit from phone revenue (based on user input)
      const phoneNetProfit = phoneRevenueGenerated * (netProfitPercent / 100);
      
      // Estimate customer retention value from well-handled calls
      const customerRetentionValue = phoneRevenueGenerated * 0.2; // 20% of revenue represents retention value
      
      // More realistic calculation of lost tips
      // Not all phone time directly translates to lost tables - some multitasking is possible
      const multitaskingFactor = 0.7; // Only 70% of phone time truly impacts table service
      const adjustedLostTips = currentPercentData.lostTips * multitaskingFactor;
      
      // Store time that could be spent with customers (opportunity)
      const customerTimeValue = totalPhoneHours * 15; // Value $15 per hour of additional customer interaction time
      
      // ROI calculation for Slang.AI
      const investmentCost = slangPlan; // Monthly subscription
      const potentialReturn = currentWithoutSlangAI - currentWithSlangAI; // Monthly savings
      const monthlyROI = potentialReturn / investmentCost * 100; // As percentage
      
      setImpactData([
        { name: 'Direct Labor Cost', value: currentPercentData.laborCost, type: 'cost' },
        { name: 'Lost Upsell Profit', value: currentPercentData.lostUpsellProfit, type: 'cost' },
        { name: 'Lost Server Tips', value: adjustedLostTips, type: 'cost' },
        { name: 'Customer Time Value', value: customerTimeValue, type: 'cost' },
        { name: 'Phone Revenue Profit', value: phoneNetProfit, type: 'gain' },
        { name: 'Customer Retention', value: customerRetentionValue, type: 'gain' },
        { name: 'Slang.AI ROI', value: potentialReturn, type: 'gain' }
      ]);
    }
    
    // Calculate an average tip percentage for the impact summary
    const avgTipPercent = servers.reduce((sum, server) => sum + (server.tipPercent || 18), 0) / Math.max(servers.length, 1);
    
    // Generate day-of-week impact data
    const dayImpacts = daysOfWeek.map((day, dayIndex) => {
      const lunchHours = hoursByDayMeal.lunch[dayIndex];
      const dinnerHours = hoursByDayMeal.dinner[dayIndex];
      const totalHours = lunchHours + dinnerHours;
      
      if (totalHours === 0) return { name: day, value: 0 };
      
      // Calculate weighted phone time for this day based on servers who work on this day
      let phoneHours = 0;
      let lostUpsellProfit = 0;
      let lostTips = 0;
      let laborCost = 0;
      
      servers.forEach(server => {
        const serverLunchHours = server.hours[dayIndex].lunch || 0;
        const serverDinnerHours = server.hours[dayIndex].dinner || 0;
        const serverDayHours = serverLunchHours + serverDinnerHours;
        
        if (serverDayHours > 0) {
          // Use this server's individual phone time percentage
          const serverPhoneHours = serverDayHours * ((server.phoneTimePercent || 15) / 100) * weeksPerMonth;
          phoneHours += serverPhoneHours;
          
          // Direct labor
          laborCost += serverPhoneHours * (server.wage || 4.74);
          
          // Lost upsells
          if (serverLunchHours > 0) {
            const lunchPhoneHours = serverLunchHours * ((server.phoneTimePercent || 15) / 100) * weeksPerMonth;
            const lunchMissedUpsells = lunchPhoneHours * missedUpsellsPerHour;
            const lunchLostUpsellRevenue = lunchMissedUpsells * upsellValue;
            lostUpsellProfit += lunchLostUpsellRevenue * (upsellMargin / 100);
            
            // Account for multitasking ability
            const multitaskingFactor = 0.7; // Only 70% of phone time truly impacts table service
            const lunchTablesNotServed = lunchPhoneHours * tablesPerHour * multitaskingFactor;
            const lunchLostCheckRevenue = lunchTablesNotServed * (checkSizes.lunch[dayIndex] || 0);
            lostTips += lunchLostCheckRevenue * ((server.tipPercent || 18) / 100);
          }
          
          if (serverDinnerHours > 0) {
            const dinnerPhoneHours = serverDinnerHours * ((server.phoneTimePercent || 15) / 100) * weeksPerMonth;
            const dinnerMissedUpsells = dinnerPhoneHours * missedUpsellsPerHour;
            const dinnerLostUpsellRevenue = dinnerMissedUpsells * upsellValue;
            lostUpsellProfit += dinnerLostUpsellRevenue * (upsellMargin / 100);
            
            // Account for multitasking ability
            const multitaskingFactor = 0.7; // Only 70% of phone time truly impacts table service
            const dinnerTablesNotServed = dinnerPhoneHours * tablesPerHour * multitaskingFactor;
            const dinnerLostCheckRevenue = dinnerTablesNotServed * (checkSizes.dinner[dayIndex] || 0);
            lostTips += dinnerLostCheckRevenue * ((server.tipPercent || 18) / 100);
          }
        }
      });
      
      const totalDayOpportunityCost = laborCost + lostUpsellProfit + lostTips;
      
      return {
        name: day,
        value: totalDayOpportunityCost,
        laborCost,
        lostUpsellProfit,
        lostTips
      };
    });
    
    setDayOfWeekData(dayImpacts);
    
  }, [servers, checkSizes, phoneTimePercent, upsellValue, upsellMargin, 
      missedUpsellsPerHour, slangAIReduction, tablesPerHour, slangPlan]);
  
  // Format currency
  const formatCurrency = (value) => {
    return `$${value.toFixed(2)}`;
  };
  
  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 shadow-lg rounded-md">
          <p className="font-bold text-sm">{`Average Phone Time: ${label}%`}</p>
          <p className="text-blue-500">{`Without Slang.AI: ${formatCurrency(payload[0].value)}`}</p>
          <p className="text-green-500">{`With Slang.AI: ${formatCurrency(payload[1].value)}`}</p>
          <p className="text-purple-500">{`Monthly Savings: ${formatCurrency(payload[2].value)}`}</p>
          <p className="text-gray-500 text-xs mt-2">The average phone time ({phoneTimePercent}%) is calculated as a weighted average based on each server's individual phone time percentage and their scheduled hours.</p>
        </div>
      );
    }
    return null;
  };
  
  // Custom tooltip for the server chart
  const ServerTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 shadow-lg rounded-md">
          <p className="font-bold text-sm">{`${label}`}</p>
          <p className="text-blue-500">{`Without Slang.AI: ${formatCurrency(payload[0].value)}`}</p>
          <p className="text-green-500">{`With Slang.AI: ${formatCurrency(payload[1].value)}`}</p>
          <p className="text-purple-500">{`Monthly Savings: ${formatCurrency(payload[0].value - payload[1].value)}`}</p>
          <p className="text-gray-500 text-xs mt-2">Monthly opportunity cost</p>
        </div>
      );
    }
    return null;
  };
  
  // Calculate current values
  const currentPhoneTimeData = chartData.find(data => data && Math.abs(data.phoneTimePercent - phoneTimePercent) < 0.01);
  
  const currentWithoutSlangAI = currentPhoneTimeData?.withoutSlangAI || 0;
  const currentWithSlangAI = currentPhoneTimeData?.withSlangAI || 0;
  const currentSavings = currentPhoneTimeData?.savings || 0;
  
  // Annual calculations
  const annualSavings = currentSavings * 12;
  const annualSlangCost = slangPlan * 12;
  const roi = annualSlangCost > 0 ? ((annualSavings / annualSlangCost) * 100) : 0;
  const paybackPeriod = currentSavings > 0 ? (slangPlan / currentSavings) : Infinity;

  // Calculate total hours
  const totalWeeklyHours = servers ? servers.reduce((total, server) => {
    return total + server.hours.reduce((dayTotal, dayHours) => {
      return dayTotal + (dayHours.lunch || 0) + (dayHours.dinner || 0);
    }, 0);
  }, 0) : 0;
  
  const weeksPerMonth = 4.3;
  const phoneHoursPerMonth = totalWeeklyHours * (phoneTimePercent / 100) * weeksPerMonth;
  const hoursReclaimed = phoneHoursPerMonth * (slangAIReduction / 100);
  
  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6 text-center">Advanced Server Opportunity Cost Calculator</h1>
      
      {/* Server Configuration */}
      <div className="bg-gray-50 p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">Server Configuration</h2>
        
        <div className="mb-4 flex justify-end">
          <button 
            onClick={addServer}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mr-2"
          >
            Add Server
          </button>
          {servers.length > 1 && (
            <button 
              onClick={() => removeServer(servers.length - 1)}
              className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            >
              Remove Server
            </button>
          )}
        </div>
        
        {servers.map((server, serverIndex) => (
          <div key={serverIndex} className="border border-gray-300 rounded-md p-4 mb-4">
            <div className="flex flex-wrap items-center mb-4">
              <div className="w-full md:w-1/4 mb-2 md:mb-0 pr-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Server Name
                </label>
                <input
                  type="text"
                  value={server.name}
                  onChange={(e) => updateServerName(serverIndex, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Server Name"
                />
              </div>
              <div className="w-full md:w-1/4 mb-2 md:mb-0 px-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Base Wage ($/hour)
                </label>
                <div className="flex items-center">
                  <span className="text-sm mr-1">$</span>
                  <input
                    type="number"
                    min="2.13"
                    max="15"
                    step="0.01"
                    value={server.wage}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || (!isNaN(parseFloat(val)))) {
                        updateServerWage(serverIndex, val === '' ? '' : parseFloat(val));
                      }
                    }}
                    onBlur={() => {
                      if (server.wage === '' || isNaN(server.wage)) {
                        updateServerWage(serverIndex, 4.74);
                      } else {
                        updateServerWage(serverIndex, Math.max(2.13, Math.min(15, server.wage)));
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
              <div className="w-full md:w-1/4 mb-2 md:mb-0 px-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Time (%)
                </label>
                <div className="flex items-center">
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="1"
                    value={server.phoneTimePercent}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || (!isNaN(parseFloat(val)))) {
                        updateServerPhoneTime(serverIndex, val === '' ? '' : parseFloat(val));
                      }
                    }}
                    onBlur={() => {
                      if (server.phoneTimePercent === '' || isNaN(server.phoneTimePercent)) {
                        updateServerPhoneTime(serverIndex, 15);
                      } else {
                        updateServerPhoneTime(serverIndex, Math.max(0, Math.min(50, server.phoneTimePercent)));
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <span className="text-sm ml-1">%</span>
                </div>
              </div>
              <div className="w-full md:w-1/4 mb-2 md:mb-0 pl-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tip Percentage (%)
                </label>
                <div className="flex items-center">
                  <input
                    type="number"
                    min="0"
                    max="30"
                    step="0.1"
                    value={server.tipPercent}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || (!isNaN(parseFloat(val)))) {
                        updateServerTipPercent(serverIndex, val === '' ? '' : parseFloat(val));
                      }
                    }}
                    onBlur={() => {
                      if (server.tipPercent === '' || isNaN(server.tipPercent)) {
                        updateServerTipPercent(serverIndex, 18);
                      } else {
                        updateServerTipPercent(serverIndex, Math.max(0, Math.min(30, server.tipPercent)));
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <span className="text-sm ml-1">%</span>
                </div>
              </div>
            </div>
            
            <h3 className="text-md font-medium mb-3">Weekly Hours</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border border-gray-300 px-2 py-1"></th>
                    {daysOfWeek.map(day => (
                      <th key={day} className="border border-gray-300 px-2 py-1 text-sm">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mealPeriods.map(mealPeriod => (
                    <tr key={mealPeriod}>
                      <td className="border border-gray-300 px-2 py-1 font-medium text-sm">{mealPeriod}</td>
                      {server.hours.map((dayHours, dayIndex) => (
                        <td key={dayIndex} className="border border-gray-300 px-1 py-1">
                          <input
                            type="number"
                            min="0"
                            max="12"
                            step="0.5"
                            value={dayHours[mealPeriod.toLowerCase()]}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0)) {
                                updateServerHours(serverIndex, dayIndex, mealPeriod.toLowerCase(), val === '' ? '' : parseFloat(val));
                              }
                            }}
                            onBlur={() => {
                              const val = server.hours[dayIndex][mealPeriod.toLowerCase()];
                              if (val === '' || isNaN(val)) {
                                updateServerHours(serverIndex, dayIndex, mealPeriod.toLowerCase(), 0);
                              } else {
                                updateServerHours(serverIndex, dayIndex, mealPeriod.toLowerCase(), Math.max(0, Math.min(12, val)));
                              }
                            }}
                            className="w-14 px-1 py-1 border border-gray-300 rounded-md text-sm"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      
      {/* Average Check Size Configuration */}
      <div className="bg-gray-50 p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">Average Check Size by Day & Meal Period ($)</h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-gray-300 px-2 py-1"></th>
                {daysOfWeek.map(day => (
                  <th key={day} className="border border-gray-300 px-2 py-1 text-sm">{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mealPeriods.map(mealPeriod => (
                <tr key={mealPeriod}>
                  <td className="border border-gray-300 px-2 py-1 font-medium text-sm">{mealPeriod}</td>
                  {checkSizes[mealPeriod.toLowerCase()].map((checkSize, dayIndex) => (
                    <td key={dayIndex} className="border border-gray-300 px-1 py-1">
                      <div className="flex items-center">
                        <span className="text-xs mr-1">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={checkSize}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0)) {
                              updateCheckSize(mealPeriod.toLowerCase(), dayIndex, val === '' ? '' : parseFloat(val));
                            }
                          }}
                          onBlur={() => {
                            const val = checkSizes[mealPeriod.toLowerCase()][dayIndex];
                            if (val === '' || isNaN(val)) {
                              updateCheckSize(mealPeriod.toLowerCase(), dayIndex, 0);
                            } else {
                              updateCheckSize(mealPeriod.toLowerCase(), dayIndex, Math.max(0, val));
                            }
                          }}
                          className="w-16 px-1 py-1 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Service Metrics and Slang.AI Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-50 p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Service & Revenue Metrics</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tables Served per Hour
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={tablesPerHour}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0)) {
                  setTablesPerHour(val === '' ? '' : parseFloat(val));
                }
              }}
              onBlur={() => {
                if (tablesPerHour === '' || isNaN(tablesPerHour)) {
                  setTablesPerHour(0);
                } else {
                  setTablesPerHour(Math.max(0, tablesPerHour));
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Upsell Value per Item ($)
            </label>
            <div className="flex items-center">
              <span className="text-sm mr-1">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={upsellValue}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0)) {
                    setUpsellValue(val === '' ? '' : parseFloat(val));
                  }
                }}
                onBlur={() => {
                  if (upsellValue === '' || isNaN(upsellValue)) {
                    setUpsellValue(0);
                  } else {
                    setUpsellValue(Math.max(0, upsellValue));
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Profit Margin on Upsells (%)
            </label>
            <div className="flex items-center">
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={upsellMargin}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0)) {
                    setUpsellMargin(val === '' ? '' : parseFloat(val));
                  }
                }}
                onBlur={() => {
                  if (upsellMargin === '' || isNaN(upsellMargin)) {
                    setUpsellMargin(0);
                  } else {
                    setUpsellMargin(Math.max(0, Math.min(100, upsellMargin)));
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <span className="text-sm ml-1">%</span>
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Net Profit Percentage (%)
            </label>
            <div className="flex items-center">
              <input
                type="number"
                min="0"
                max="50"
                step="0.1"
                value={netProfitPercent}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0)) {
                    setNetProfitPercent(val === '' ? '' : parseFloat(val));
                  }
                }}
                onBlur={() => {
                  if (netProfitPercent === '' || isNaN(netProfitPercent)) {
                    setNetProfitPercent(0);
                  } else {
                    setNetProfitPercent(Math.max(0, Math.min(50, netProfitPercent)));
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <span className="text-sm ml-1">%</span>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Slang.AI Settings</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Calls Handled by Slang.AI (%)
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={slangAIReduction}
              onChange={(e) => setSlangAIReduction(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>0%</span>
              <span>{slangAIReduction}%</span>
              <span>100%</span>
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Slang.AI Plan
            </label>
            <select
              value={slangPlan}
              onChange={(e) => setSlangPlan(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="0">No Subscription ($0.00)</option>
              <option value="399">Core Plan ($399.00)</option>
              <option value="599">Premium Plan ($599.00)</option>
            </select>
          </div>
          
          <div className="bg-white p-3 rounded border border-gray-200 mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Opportunity vs. Gain Analysis</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={impactData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {impactData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.type === 'gain' ? '#4ade80' : '#ef4444'} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name) => [
                      formatCurrency(value), 
                      `${name} (${value > 0 ? ((value / (currentWithoutSlangAI + 0.01)) * 100).toFixed(1) + '% of opportunity cost' : ''})`
                    ]} 
                  />
                  <Legend formatter={(value) => {
                    const item = impactData.find(item => item.name === value);
                    return item ? `${value} (${item.type === 'gain' ? 'Gain' : 'Cost'})` : value;
                  }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-xs text-gray-600">
              <p>Red segments: Costs/Opportunity Losses | Green segments: Gains/Benefits</p>
              <p>ROI: {roi.toFixed(0)}% | Net Profit Rate: {netProfitPercent}% | Slang.AI Monthly Impact: {formatCurrency(currentSavings)}</p>
            </div>
          </div>
          
          <div className="bg-white p-3 rounded border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Day of Week Impact</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayOfWeekData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => `$${value}`} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="value" fill="#82ca9d" name="Opportunity Cost" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
      
      {/* Results Summary */}
      <div className="mb-8 bg-blue-50 p-4 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-2">Cost Summary at {phoneTimePercent}% Average Phone Time</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-white p-3 rounded border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">Monthly Opportunity Cost</h3>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(currentWithoutSlangAI)}</p>
            <p className="text-xs text-gray-500">Without Slang.AI</p>
          </div>
          <div className="bg-white p-3 rounded border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">Monthly Cost</h3>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(currentWithSlangAI)}</p>
            <p className="text-xs text-gray-500">With Slang.AI</p>
          </div>
          <div className="bg-white p-3 rounded border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">Monthly Savings</h3>
            <p className={`text-2xl font-bold ${currentSavings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {currentSavings >= 0 ? '+' : ''}{formatCurrency(currentSavings)}
            </p>
            <p className="text-xs text-gray-500">Using Slang.AI</p>
          </div>
          <div className="bg-white p-3 rounded border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">Server Hours Reclaimed</h3>
            <p className="text-2xl font-bold text-blue-600">{hoursReclaimed.toFixed(1)}</p>
            <p className="text-xs text-gray-500">Hours per month back to table service</p>
          </div>
        </div>
        
        {/* Additional metrics */}
        <h3 className="text-sm font-medium text-gray-700 mt-4 mb-2">Advanced Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-3 rounded border border-gray-200">
            <h3 className="text-xs font-medium text-gray-700">Annual Savings</h3>
            <p className={`text-lg font-bold ${annualSavings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {annualSavings >= 0 ? '+' : ''}{formatCurrency(annualSavings)}
            </p>
            <p className="text-xs text-gray-500">Projected yearly impact</p>
          </div>
          <div className="bg-white p-3 rounded border border-gray-200">
            <h3 className="text-xs font-medium text-gray-700">ROI</h3>
            <p className={`text-lg font-bold ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {roi.toFixed(0)}%
            </p>
            <p className="text-xs text-gray-500">Annual return on investment</p>
          </div>
          <div className="bg-white p-3 rounded border border-gray-200">
            <h3 className="text-xs font-medium text-gray-700">Payback Period</h3>
            <p className="text-lg font-bold text-blue-600">
              {paybackPeriod === Infinity ? 'N/A' : 
               paybackPeriod <= 0 ? 'Immediate' :
               paybackPeriod <= 1 ? '< 1 month' :
               `${paybackPeriod.toFixed(1)} months`}
            </p>
            <p className="text-xs text-gray-500">Time to recover investment</p>
          </div>
        </div>
      </div>
      
      {/* Server Impact Chart */}
      <div className="bg-white p-4 rounded-lg shadow mb-6 h-96">
        <h3 className="text-md font-medium mb-3">Individual Server Impact (Based on Each Server's Phone Time %)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={serverImpactData}
            margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
            layout="vertical"
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(value) => `$${value}`} />
            <YAxis dataKey="name" type="category" width={100} />
            <Tooltip content={<ServerTooltip />} />
            <Legend verticalAlign="top" />
            <Bar dataKey="totalOpportunityCost" name="Without Slang.AI" fill="#3b82f6" />
            <Bar dataKey="withSlangAICost" name="With Slang.AI" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Phone Time Impact Chart */}
      <div className="bg-white p-4 rounded-lg shadow h-96 mb-6">
        <h3 className="text-md font-medium mb-3">Average Phone Time Impact Chart</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="phoneTimePercent" 
              label={{ value: 'Average Phone Time (%)', position: 'insideBottom', offset: -5 }} 
            />
            <YAxis 
              label={{ value: 'Monthly Cost ($)', angle: -90, position: 'insideLeft' }}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="withoutSlangAI" 
              name="Opportunity Cost Without Slang.AI" 
              stroke="#3b82f6" 
              strokeWidth={2} 
              dot={false} 
              activeDot={{ r: 6 }} 
            />
            <Line 
              type="monotone" 
              dataKey="withSlangAI" 
              name="Cost With Slang.AI" 
              stroke="#10b981" 
              strokeWidth={2} 
              dot={false} 
              activeDot={{ r: 6 }} 
            />
            <Line 
              type="monotone" 
              dataKey="savings" 
              name="Monthly Savings" 
              stroke="#8b5cf6" 
              strokeWidth={2} 
              dot={false} 
              activeDot={{ r: 6 }} 
            />
            {phoneTimePercent && (
              <ReferenceDot 
                x={phoneTimePercent} 
                y={currentWithoutSlangAI} 
                r={6} 
                fill="red" 
                stroke="none"
              >
                <Label 
                  value={`Current: ${phoneTimePercent}%`} 
                  position="top" 
                  fill="red"
                  fontSize={12}
                  fontWeight="bold" 
                />
              </ReferenceDot>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-4 text-sm text-gray-500">
        <p>Note: This advanced calculator provides a detailed analysis of the costs and benefits when servers spend time on phone duties. The calculations now include a comprehensive balance of both opportunity costs and potential gains, with ROI and net profit metrics to help you make data-driven decisions.</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Direct labor costs when servers are on phones</li>
          <li>Realistic lost upsell opportunities (adjusted for multitasking abilities)</li>
          <li>More accurate lost tip calculations that recognize servers can partially multitask</li>
          <li>The value of customer-facing time that could be reclaimed</li>
          <li>Positive net profit generated from successful phone calls and reservations (based on your profit margin)</li>
          <li>Customer retention value from well-handled phone interactions</li>
          <li>Slang.AI ROI based on monthly subscription cost vs. potential savings</li>
        </ul>
        <p className="mt-2">The pie chart shows both costs (red) and gains (green) to provide a balanced view of phone duties' financial impact, while incorporating your restaurant's net profit percentage to make the analysis more relevant to your specific business.</p>
      </div>
    </div>
  );
};

export default AdvancedServerOpportunityCostCalculator;